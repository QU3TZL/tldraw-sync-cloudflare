/**
 * Shared Tldraw Schema
 * ====================
 *
 * This schema MUST match frontend/src/services/canvas/tldrawCustomSchema.ts EXACTLY
 * Any changes here must be reflected in the frontend schema file.
 */

import { createTLSchema, defaultShapeSchemas } from "@tldraw/tlschema";

export const sharedTldrawSchema = createTLSchema({
  shapes: {
    ...defaultShapeSchemas,
    // Custom document shape for displaying documents (PDF, DOCX, TXT, MD) on canvas
    document: {
      props: {
        documentId: { type: "string", default: "" },
        fileName: { type: "string", default: "document.pdf" },
        fileType: { type: "string", default: "PDF" },
        fileSize: { type: "number", default: 0 },
        mimeType: { type: "string", default: "application/pdf" },
        documentIcon: { type: "string", default: "📄" },
        r2Url: { type: "string", default: "" },
        previewContent: { type: "string", default: "" },
        chunks: { type: "array", default: [] },
        w: { type: "number", default: 110 },
        h: { type: "number", default: 160 },
      },
      migrations: {
        currentVersion: 1,
        migrators: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          1: { up: (shape: any) => shape, down: (shape: any) => shape },
        },
      },
    },
    // Custom response shape for displaying AI responses/previews on canvas
    response: {
      props: {
        html: { type: "string", default: "" },
        url: { type: "string", default: "" }, // External URL for embedding (Google Calendar, Slides, etc.)
        w: { type: "number", default: 200 },
        h: { type: "number", default: 150 },
        name: { type: "string", default: "" }, // Editable name for the node
        imageRefs: { type: "array", default: [] },
        documentRefs: { type: "array", default: [] },
        isUserCode: { type: "boolean", default: false },
      },
      migrations: {
        currentVersion: 1,
        migrators: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          1: { up: (shape: any) => shape, down: (shape: any) => shape },
        },
      },
    },
    // Custom code shape for displaying HTML/JS/CSS code files on canvas
    code: {
      props: {
        codeId: { type: "string", default: "" },
        fileName: { type: "string", default: "code.js" },
        fileType: { type: "string", default: "JS" },
        fileSize: { type: "number", default: 0 },
        mimeType: { type: "string", default: "text/javascript" },
        codeIcon: { type: "string", default: "💻" },
        r2Url: { type: "string", default: "" },
        htmlContent: { type: "string", default: "" },
        language: { type: "string", default: "javascript" },
        w: { type: "number", default: 110 },
        h: { type: "number", default: 160 },
      },
      migrations: {
        currentVersion: 1,
        migrators: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          1: { up: (shape: any) => shape, down: (shape: any) => shape },
        },
      },
    },
    // Custom STL shape for displaying 3D CAD files on canvas
    stl: {
      props: {
        stlId: { type: "string", default: "" },
        fileName: { type: "string", default: "model.stl" },
        fileSize: { type: "number", default: 0 },
        mimeType: { type: "string", default: "model/stl" },
        r2Url: { type: "string", default: "" },
        w: { type: "number", default: 125 },
        h: { type: "number", default: 125 },
        rotationX: { type: "number", default: 0 },
        rotationY: { type: "number", default: 0 },
        rotationZ: { type: "number", default: 0 },
        scale: { type: "number", default: 1 },
        wireframe: { type: "boolean", default: false },
      },
      migrations: {
        currentVersion: 1,
        migrators: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          1: { up: (shape: any) => shape, down: (shape: any) => shape },
        },
      },
    },
    // Custom audio shape for displaying audio files on canvas
    audio: {
      props: {
        audioId: { type: "string", default: "" },
        fileName: { type: "string", default: "audio.mp3" },
        fileType: { type: "string", default: "MP3" },
        fileSize: { type: "number", default: 0 },
        mimeType: { type: "string", default: "audio/mpeg" },
        duration: { type: "number", default: 0 },
        r2Url: { type: "string", default: "" },
        w: { type: "number", default: 110 },
        h: { type: "number", default: 110 },
      },
      migrations: {
        currentVersion: 1,
        migrators: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          1: { up: (shape: any) => shape, down: (shape: any) => shape },
        },
      },
    },
    // Extend native video shape with lazy loading props
    // Note: Overriding defaultShapeSchemas.video to add new props
    video: {
      props: {
        // Native video props (from defaultShapeSchemas)
        w: { type: "number", default: 853 } as any,
        h: { type: "number", default: 480 } as any,
        time: { type: "number", default: 0 } as any,
        playing: { type: "boolean", default: false } as any,
        autoplay: { type: "boolean", default: false } as any,
        url: { type: "string", default: "" } as any,
        assetId: { type: "string", default: null } as any,
        altText: { type: "string", default: "" } as any,
        // New lazy loading props (must be JSON serializable - use null instead of undefined)
        isLoaded: { type: "boolean", default: false } as any,
        thumbnailUrl: { type: "string", default: null } as any,
        lastPauseTime: { type: "number", default: null } as any,
      } as any,
      migrations: {
        currentVersion: 2,
        migrators: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          1: { up: (shape: any) => shape, down: (shape: any) => shape },
          // Migration from v1 to v2: add lazy loading props to existing videos
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          2: {
            up: (shape: any) => {
              // Add lazy loading props with defaults for existing videos
              // Use null instead of undefined for JSON serialization
              return {
                ...shape,
                props: {
                  ...shape.props,
                  isLoaded: shape.props.isLoaded ?? false,
                  thumbnailUrl: shape.props.thumbnailUrl ?? null,
                  lastPauseTime: shape.props.lastPauseTime ?? null,
                },
              };
            },
            down: (shape: any) => {
              // Remove lazy loading props when migrating down
              const { isLoaded, thumbnailUrl, lastPauseTime, ...restProps } =
                shape.props;
              return {
                ...shape,
                props: restProps,
              };
            },
          },
        },
      },
    } as any,
    // Custom workflow input shape for interactive prompts
    "workflow-input": {
      props: {
        w: { type: "number", default: 400 },
        h: { type: "number", default: 200 },
        text: { type: "string", default: "" },
        placeholder: { type: "string", default: "Enter prompt..." },
      },
      migrations: {
        firstVersion: 1,
        currentVersion: 1,
        migrators: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          1: { up: (shape: any) => shape, down: (shape: any) => shape },
        },
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);
