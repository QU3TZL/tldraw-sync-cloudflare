import { RoomSnapshot, TLSocketRoom } from "@tldraw/sync-core";
import { TLRecord } from "@tldraw/tlschema";
import { AutoRouter, IRequest, error } from "itty-router";
const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024; // 5 MB guardrail to prevent costly writes
// Import the shared schema - single source of truth for both client and server
// This ensures exact schema match and prevents CLIENT_TOO_OLD errors
import { schema } from "../../shared/tldrawSchema";

// each whiteboard room is hosted in a DurableObject:
// https://developers.cloudflare.com/durable-objects/

// there's only ever one durable object instance per room. it keeps all the room state in memory and
// handles websocket connections. periodically, it persists the room state to the R2 bucket.
export class TldrawDurableObject {
  private r2: R2Bucket;
  // the room ID will be missing while the room is being initialized
  private roomId: string | null = null;
  // when we load the room from the R2 bucket, we keep it here. it's a promise so we only ever
  // load it once.
  private roomPromise: Promise<TLSocketRoom<TLRecord, void>> | null = null;
  // Track active WebSocket connections for hibernation
  private activeConnections = new Set<WebSocket>();
  // Map sockets to session/room so hibernation lifecycle handlers can forward messages
  private socketSessions = new Map<
    WebSocket,
    { sessionId: string; room: TLSocketRoom<TLRecord, void> }
  >();
  // Track latest socket per session to prevent parallel connections
  private sessionSockets = new Map<string, WebSocket>();
  // Track last close time per session to apply reconnect backoff
  private sessionLastCloseAt = new Map<string, number>();
  private lastPersistAt: number | null = null;
  // Reconnect backoff window (ms)
  private static readonly RECONNECT_BACKOFF_MS = 30_000;
  // Minimum interval between persists (ms)
  private static readonly MIN_PERSIST_INTERVAL_MS = 10_000;

  constructor(private readonly ctx: DurableObjectState, env: Env) {
    this.r2 = env.TLDRAW_BUCKET;

    ctx.blockConcurrencyWhile(async () => {
      this.roomId = ((await this.ctx.storage.get("roomId")) ?? null) as
        | string
        | null;
    });
  }

  private readonly router = AutoRouter({
    catch: (e) => {
      console.log(e);
      return error(e);
    },
  })
    // when we get a connection request, we stash the room id if needed and handle the connection
    .get("/api/connect/:roomId", async (request) => {
      if (!this.roomId) {
        await this.ctx.blockConcurrencyWhile(async () => {
          await this.ctx.storage.put("roomId", request.params.roomId);
          this.roomId = request.params.roomId;
        });
      }
      return this.handleConnect(request);
    })
    // Handle delete room data request
    .post("/delete", async () => {
      await this.deleteRoomData();
      return new Response(
        JSON.stringify({ success: true, message: "Room data deleted" }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    });

  // `fetch` is the entry point for all requests to the Durable Object
  fetch(request: Request): Response | Promise<Response> {
    return this.router.fetch(request);
  }

  // what happens when someone tries to connect to this room?
  async handleConnect(request: IRequest) {
    // extract query params from request
    const sessionId = request.query.sessionId as string;
    if (!sessionId) return error(400, "Missing sessionId");

    // Reconnect backoff: if the same session closed recently, reject fast
    const lastClose = this.sessionLastCloseAt.get(sessionId);
    if (
      lastClose &&
      Date.now() - lastClose < TldrawDurableObject.RECONNECT_BACKOFF_MS
    ) {
      console.warn("⚠️ Reconnect backoff: rejecting rapid reconnect", {
        sessionId,
        roomId: this.roomId,
      });

      // Accept and immediately close with rate limit code so client can back off
      const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();
      this.ctx.acceptWebSocket(serverWebSocket);
      this.sessionLastCloseAt.set(sessionId, Date.now());
      try {
        serverWebSocket.close(
          4001,
          `RATE_LIMITED:${TldrawDurableObject.RECONNECT_BACKOFF_MS}`
        );
      } catch {
        // ignore
      }
      return new Response(null, { status: 101, webSocket: clientWebSocket });
    }

    // Create the websocket pair for the client
    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();

    // Use acceptWebSocket to enable hibernation - this allows the Durable Object
    // to hibernate when all WebSockets close, reducing duration charges
    this.ctx.acceptWebSocket(serverWebSocket);
    this.activeConnections.add(serverWebSocket);

    // Enforce single live socket per sessionId - close any previous one
    const existing = this.sessionSockets.get(sessionId);
    if (existing && existing !== serverWebSocket) {
      try {
        existing.close(4000, "replaced_by_new_connection");
      } catch {
        // ignore
      }
      this.cleanupSocket(existing);
    }
    this.sessionSockets.set(sessionId, serverWebSocket);

    // load the room, or retrieve it if it's already loaded
    const room = await this.getRoom();

    // Log room info
    console.log("🔍 Server connecting client:", {
      sessionId,
      roomId: this.roomId,
      hasRoom: !!room,
    });

    try {
      // Log schema info before connecting
      const schemaAny = schema as any;
      console.log("🔍 Server schema info before connect:", {
        hasSchema: !!schema,
        schemaShapes: schemaAny?.types?.shape
          ? Object.keys(schemaAny.types.shape).slice(0, 20)
          : schemaAny?.shapes
          ? Object.keys(schemaAny.shapes).slice(0, 10)
          : [],
        // Try to get protocol version from schema if available
        schemaVersion: schemaAny?.version,
        schemaSequence: schemaAny?.storeMigrations?.sequence?.length,
      });

      // connect the client to the room
      room.handleSocketConnect({ sessionId, socket: serverWebSocket });
      console.log("✅ Server connected client to room");
      this.socketSessions.set(serverWebSocket, { sessionId, room });
    } catch (err) {
      console.error("❌ Server error connecting client:", err);
      console.error("❌ Error details:", {
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : "Unknown",
        stack: err instanceof Error ? err.stack : "No stack",
      });

      // If CLIENT_TOO_OLD error, try clearing room data and reconnecting
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.includes("CLIENT_TOO_OLD") ||
        errorMessage.includes("too old")
      ) {
        console.warn(
          "⚠️ CLIENT_TOO_OLD detected - clearing room data and starting fresh"
        );
        try {
          await this.deleteRoomData();
          // Reset room promise to create a fresh room
          this.roomPromise = null;
          // Try connecting again with fresh room
          const freshRoom = await this.getRoom();
          freshRoom.handleSocketConnect({ sessionId, socket: serverWebSocket });
          console.log("✅ Reconnected with fresh room after CLIENT_TOO_OLD");
          this.socketSessions.set(serverWebSocket, {
            sessionId,
            room: freshRoom,
          });
        } catch (retryErr) {
          console.error("❌ Failed to recover from CLIENT_TOO_OLD:", retryErr);
        }
      }
    }

    // return the websocket connection to the client
    return new Response(null, { status: 101, webSocket: clientWebSocket });
  }

  getRoom() {
    const roomId = this.roomId;
    if (!roomId) throw new Error("Missing roomId");

    if (!this.roomPromise) {
      this.roomPromise = (async () => {
        // fetch the room from R2
        const roomFromBucket = await this.r2.get(`rooms/${roomId}`);

        // if it doesn't exist, we'll just create a new empty room
        // IMPORTANT: If there's old room data with incompatible protocol version,
        // we should skip it to avoid CLIENT_TOO_OLD errors
        let initialSnapshot: RoomSnapshot | undefined = undefined;
        if (roomFromBucket) {
          try {
            const snapshot = (await roomFromBucket.json()) as RoomSnapshot;
            // Check if snapshot has protocol version info
            console.log("📦 Loaded room snapshot from R2:", {
              roomId,
              hasSnapshot: !!snapshot,
              snapshotKeys: snapshot ? Object.keys(snapshot).slice(0, 5) : [],
              // Check for protocol version in snapshot
              hasProtocolVersion: !!(snapshot as any)?.protocolVersion,
              hasSchemaVersion: !!(snapshot as any)?.schemaVersion,
            });

            // CRITICAL: Check schema version compatibility to avoid CLIENT_TOO_OLD errors
            // When schema changes (e.g., adding custom shapes), old snapshots become incompatible
            const snapshotAny = snapshot as any;
            const currentSchemaVersion = (schema as any)?.version;
            const snapshotSchemaVersion =
              snapshotAny?.schemaVersion ||
              snapshotAny?._metadata?.schemaVersion;

            // If snapshot doesn't have schema version or versions don't match, skip it
            // This prevents CLIENT_TOO_OLD errors when schema changes
            if (!snapshotSchemaVersion) {
              console.warn(
                "⚠️ Old snapshot detected (no schema version) - starting fresh to avoid CLIENT_TOO_OLD"
              );
              console.warn(
                "💡 Old room data will be ignored. Room will start fresh."
              );

              // Delete the old snapshot to prevent future issues
              try {
                await this.r2.delete(`rooms/${roomId}`);
                console.log("🗑️ Deleted old incompatible room data from R2");
              } catch (deleteErr) {
                console.warn("⚠️ Failed to delete old room data:", deleteErr);
              }

              initialSnapshot = undefined;
            } else if (snapshotSchemaVersion !== currentSchemaVersion) {
              console.warn(
                "⚠️ Schema version mismatch detected - starting fresh to avoid CLIENT_TOO_OLD"
              );
              console.warn("Current schema version:", currentSchemaVersion);
              console.warn("Snapshot schema version:", snapshotSchemaVersion);
              console.warn(
                "💡 Old room data will be ignored. Room will start fresh."
              );

              // Delete the old snapshot to prevent future issues
              try {
                await this.r2.delete(`rooms/${roomId}`);
                console.log("🗑️ Deleted old incompatible room data from R2");
              } catch (deleteErr) {
                console.warn("⚠️ Failed to delete old room data:", deleteErr);
              }

              initialSnapshot = undefined;
            } else {
              // Schema versions match, safe to use snapshot
              console.log(
                "✅ Snapshot schema version matches, loading room data"
              );
              initialSnapshot = snapshot;
            }
          } catch (err) {
            console.error(
              "❌ Failed to parse room snapshot, starting fresh:",
              err
            );
            // Start with empty room if snapshot is corrupted
            initialSnapshot = undefined;
          }
        }

        // create a new TLSocketRoom. This handles all the sync protocol & websocket connections.
        // it's up to us to persist the room state to R2 when needed though.
        const schemaAny = schema as any;
        console.log("🔍 Creating TLSocketRoom:", {
          roomId,
          hasInitialSnapshot: !!initialSnapshot,
          schemaType: typeof schema,
          schemaShapes: schemaAny?.types?.shape
            ? Object.keys(schemaAny.types.shape).slice(0, 20)
            : [],
          schemaVersion: schemaAny?.version,
          schemaSequence: schemaAny?.storeMigrations?.sequence?.length,
        });

        const room = new TLSocketRoom<TLRecord, void>({
          schema: schema as any, // Type assertion needed - schema is TLSchema but TLSocketRoom expects StoreSchema
          initialSnapshot,
          onDataChange: () => {
            // and persist whenever the data in the room changes
            this.schedulePersistToR2();
          },
        });

        // Add error handler to room if available
        if (room && typeof (room as any).onError === "function") {
          (room as any).onError((error: Error) => {
            console.error("🔴 TLSocketRoom error:", {
              error: error.message,
              stack: error.stack,
              roomId,
              schemaVersion: schemaAny?.version,
              schemaShapes: schemaAny?.types?.shape
                ? Object.keys(schemaAny.types.shape)
                : [],
            });
          });
        }

        // Add sync error handler to catch INVALID_RECORD errors
        if (room && typeof (room as any).onSyncError === "function") {
          (room as any).onSyncError((error: any) => {
            console.error("🔴 TLSocketRoom sync error:", {
              error: error?.message || String(error),
              errorType: error?.type,
              errorCode: error?.code,
              roomId,
              schemaVersion: schemaAny?.version,
            });
            // If it's an INVALID_RECORD error, log more details
            if (
              error?.message?.includes("INVALID_RECORD") ||
              error?.code === "INVALID_RECORD"
            ) {
              console.error(
                "⚠️ INVALID_RECORD detected - this may indicate schema mismatch or corrupted data"
              );
              console.error("   Consider clearing room data if this persists");
            }
          });
        }

        return room;
      })();
    }

    return this.roomPromise;
  }

  // we throttle persistance so it only happens every 10 seconds
  schedulePersistToR2 = async () => {
    if (!this.roomPromise || !this.roomId) return;
    const now = Date.now();
    // Enforce minimum persist interval to reduce churn
    if (
      this.lastPersistAt &&
      now - this.lastPersistAt < TldrawDurableObject.MIN_PERSIST_INTERVAL_MS
    ) {
      return;
    }
    this.lastPersistAt = now;
    const room = await this.getRoom();

    // convert the room to JSON and upload it to R2
    const snapshot = room.getCurrentSnapshot();
    const schemaAny = schema as any;
    // Add metadata to help identify schema version issues
    // Include schema version so we can detect incompatible snapshots
    const snapshotWithMetadata = {
      ...snapshot,
      schemaVersion: schemaAny?.version, // Include schema version for compatibility checking
      _metadata: {
        savedAt: new Date().toISOString(),
        protocolVersion: "4.1.2", // Mark with current protocol version
        schemaVersion: schemaAny?.version, // Also in metadata for backwards compatibility
      },
    };
    const snapshotJson = JSON.stringify(snapshotWithMetadata);
    const snapshotBytes = new TextEncoder().encode(snapshotJson).byteLength;
    if (snapshotBytes > MAX_SNAPSHOT_BYTES) {
      console.error("🔴 Snapshot too large - skipping persist", {
        roomId: this.roomId,
        snapshotBytes,
        maxBytes: MAX_SNAPSHOT_BYTES,
      });
      return;
    }

    const start = Date.now();
    await this.r2.put(`rooms/${this.roomId}`, snapshotJson);
    this.lastPersistAt = Date.now();
    console.log("💾 Persisted room snapshot", {
      roomId: this.roomId,
      snapshotBytes,
      durationMs: Date.now() - start,
    });
  };

  // Helper method to delete room data (for clearing old incompatible data)
  async deleteRoomData() {
    if (!this.roomId) return;
    try {
      await this.r2.delete(`rooms/${this.roomId}`);
      console.log(`🗑️ Deleted room data for: ${this.roomId}`);
      // Reset room promise so it creates a fresh room
      this.roomPromise = null;
    } catch (err) {
      console.error(`❌ Failed to delete room data: ${err}`);
    }
  }

  // Hibernation support: route messages to TLSocketRoom when Cloudflare delivers them
  webSocketMessage(ws: WebSocket, event: MessageEvent) {
    const session = this.socketSessions.get(ws);
    if (!session) {
      console.warn("⚠️ Received message for unknown socket (possibly stale)", {
        roomId: this.roomId,
      });
      return;
    }

    try {
      const data = (event as any)?.data ?? event;
      session.room.handleSocketMessage(session.sessionId, data as any);
    } catch (err) {
      console.error("🔴 WebSocket message handling failed:", {
        error: err instanceof Error ? err.message : String(err),
        roomId: this.roomId,
        sessionId: session.sessionId,
      });
      session.room.handleSocketError(session.sessionId);
    }
  }

  // Hibernation support: Called when a WebSocket closes
  // This allows the Durable Object to hibernate when all connections close,
  // which stops accumulating duration charges
  webSocketClose(ws: WebSocket, event: CloseEvent) {
    const session = this.socketSessions.get(ws);
    console.log("🔌 WebSocket closed, object may hibernate:", {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      roomId: this.roomId,
      remainingConnections: this.activeConnections.size - 1,
      sessionId: session?.sessionId,
    });

    if (session) {
      try {
        session.room.handleSocketClose(session.sessionId);
      } catch (err) {
        console.error("⚠️ Failed to notify room of socket close:", err);
      }
      // Track last close to enforce reconnect backoff
      this.sessionLastCloseAt.set(session.sessionId, Date.now());
    }

    this.cleanupSocket(ws);

    // If this was the last connection, ensure we persist the room state
    // before hibernation
    if (this.activeConnections.size === 0 && this.roomPromise && this.roomId) {
      console.log(
        "💤 Last connection closed, persisting room before hibernation"
      );
      // Schedule a final persistence - this will run before hibernation
      this.ctx.waitUntil(
        (async () => {
          try {
            const room = await this.getRoom();
            const snapshot = room.getCurrentSnapshot();
            const schemaAny = schema as any;
            const snapshotWithMetadata = {
              ...snapshot,
              schemaVersion: schemaAny?.version,
              _metadata: {
                savedAt: new Date().toISOString(),
                protocolVersion: "4.1.2",
                schemaVersion: schemaAny?.version,
              },
            };
            const snapshotJson = JSON.stringify(snapshotWithMetadata);
            const snapshotBytes = new TextEncoder().encode(
              snapshotJson
            ).byteLength;
            if (snapshotBytes > MAX_SNAPSHOT_BYTES) {
              console.error(
                "🔴 Final persistence skipped: snapshot too large before hibernation",
                {
                  roomId: this.roomId,
                  snapshotBytes,
                  maxBytes: MAX_SNAPSHOT_BYTES,
                }
              );
              return;
            }

            const start = Date.now();
            await this.r2.put(`rooms/${this.roomId}`, snapshotJson);
            console.log("✅ Final persistence completed before hibernation", {
              roomId: this.roomId,
              snapshotBytes,
              durationMs: Date.now() - start,
            });
          } catch (err) {
            console.error("❌ Error during final persistence:", err);
          }
        })()
      );
    }
  }

  // Hibernation support: Called when a WebSocket error occurs
  webSocketError(ws: WebSocket, error: Error) {
    const session = this.socketSessions.get(ws);
    console.error("🔴 WebSocket error:", {
      error: error.message,
      roomId: this.roomId,
      sessionId: session?.sessionId,
    });

    if (session) {
      try {
        session.room.handleSocketError(session.sessionId);
      } catch (err) {
        console.error("⚠️ Failed to notify room of socket error:", err);
      }
    }
    this.cleanupSocket(ws);
  }

  private cleanupSocket(ws: WebSocket) {
    this.activeConnections.delete(ws);
    const session = this.socketSessions.get(ws);
    if (session) {
      this.socketSessions.delete(ws);
      const current = this.sessionSockets.get(session.sessionId);
      if (current === ws) {
        this.sessionSockets.delete(session.sessionId);
      }
    }
  }
}
