

/**
 * CryptoService: Handles Zero-Knowledge Encryption
 * Uses Web Crypto API for AES-GCM 256-bit encryption.
 */

export class CryptoService {
  private static ALGORITHM = 'AES-GCM';
  // 2025 OWASP/NIST Recommendation: 600,000 iterations for PBKDF2-HMAC-SHA256
  private static KDF_ITERATIONS = 600000;
  private static SALT_LENGTH = 16;
  private static IV_LENGTH = 12;

  /**
   * Derives a Key from a password string using PBKDF2
   */
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: this.KDF_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGORITHM, length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts a JSON object into a proprietary binary format
   * Format: [Salt (16b)][IV (12b)][Ciphertext]
   */
  public static async encryptData(data: unknown, password: string): Promise<Blob> {
      const salt: Uint8Array<ArrayBuffer> = new Uint8Array(this.SALT_LENGTH);
      window.crypto.getRandomValues(salt);
      const iv: Uint8Array<ArrayBuffer> = new Uint8Array(this.IV_LENGTH);
      window.crypto.getRandomValues(iv);
    const key = await this.deriveKey(password, salt);

    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(data));

    const ciphertext = await window.crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv: iv },
      key,
      encodedData
    );

    // Combine Salt + IV + Ciphertext
    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

    return new Blob([combined], { type: 'application/octet-stream' });
  }

  /**
   * Decrypts the proprietary binary format back to JSON
   */
  public static async decryptData(blob: Blob, password: string): Promise<unknown> {
    const buffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    // Extract parts
    const salt = uint8.slice(0, this.SALT_LENGTH);
    const iv = uint8.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
    const ciphertext = uint8.slice(this.SALT_LENGTH + this.IV_LENGTH);

    try {
      const key = await this.deriveKey(password, salt);
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv: iv },
        key,
        ciphertext
      );

      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decryptedBuffer));
    } catch {
      throw new Error("Invalid Password or Corrupt File");
    }
  }
}