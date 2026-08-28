import { describe, expect, it } from "vitest";
import { validateProductImage } from "./productUpload";

describe("product image validation", () => {
  it("accepts supported MIME types and extensions under 5 MB", () => {
    expect(validateProductImage({ mimetype: "image/png", originalname: "peca.PNG", size: 1024 })).toBeNull();
    expect(validateProductImage({ mimetype: "image/jpeg", originalname: "peca.jpg", size: 5 * 1024 * 1024 })).toBeNull();
    expect(validateProductImage({ mimetype: "image/webp", originalname: "peca.webp", size: 1024 })).toBeNull();
  });

  it("rejects unsupported MIME types or extensions", () => {
    expect(validateProductImage({ mimetype: "application/pdf", originalname: "peca.pdf", size: 1024 })).toContain("JPG");
    expect(validateProductImage({ mimetype: "image/png", originalname: "peca.gif", size: 1024 })).toContain("JPG");
  });

  it("rejects files above the 5 MB limit", () => {
    expect(validateProductImage({ mimetype: "image/png", originalname: "peca.png", size: 5 * 1024 * 1024 + 1 })).toBe("A imagem precisa ter no máximo 5 MB");
  });
});
