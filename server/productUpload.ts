import type { Express, Request } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createContext } from "./_core/context";
import { storagePut } from "./storage";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export function validateProductImage(file: { mimetype: string; originalname: string; size: number }) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) return "Selecione uma imagem JPG, PNG ou WEBP";
  if (file.size > MAX_IMAGE_SIZE) return "A imagem precisa ter no máximo 5 MB";
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, allowedMimeTypes.has(file.mimetype) && allowedExtensions.has(extension));
  },
});

function getUploadErrorMessage(error: unknown) {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return "A imagem precisa ter no máximo 5 MB";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível receber a imagem";
}

export function registerProductImageUpload(app: Express) {
  app.post("/api/uploads/product-image", (req, res) => {
    upload.single("image")(req, res, async error => {
      if (error) {
        res.status(400).json({ message: getUploadErrorMessage(error) });
        return;
      }

      try {
        const context = await createContext({ req: req as Request, res, info: undefined as never });
        if (!context.user) {
          res.status(401).json({ message: "Faça login para enviar uma imagem" });
          return;
        }

        const file = req.file;
        if (!file) {
          res.status(400).json({ message: "Selecione uma imagem JPG, PNG ou WEBP" });
          return;
        }
        const validationMessage = validateProductImage(file);
        if (validationMessage) {
          res.status(400).json({ message: validationMessage });
          return;
        }

        const extension = path.extname(file.originalname).toLowerCase();
        const key = `product-images/${context.user.id}/${randomUUID()}${extension}`;
        const uploaded = await storagePut(key, file.buffer, file.mimetype);
        res.json({ url: uploaded.url, key: uploaded.key });
      } catch (uploadError) {
        console.error("[Product image upload]", uploadError);
        res.status(500).json({ message: "Não foi possível enviar a imagem" });
      }
    });
  });
}
