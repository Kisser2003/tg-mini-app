import { describe, expect, it } from "vitest";
import { presignS3Url } from "@/lib/s3-presign";

describe("presignS3Url", () => {
  it("matches the AWS SigV4 documentation example (presigned GET)", () => {
    const url = presignS3Url({
      method: "GET",
      host: "examplebucket.s3.amazonaws.com",
      path: "/test.txt",
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      expiresSeconds: 86400,
      now: new Date("2013-05-24T00:00:00Z")
    });
    expect(url).toContain(
      "X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"
    );
  });

  it("encodes path segments but keeps slashes", () => {
    const url = presignS3Url({
      method: "PUT",
      host: "s3.example.com",
      path: "/bucket/1/a b/ё.wav",
      region: "r",
      accessKeyId: "k",
      secretAccessKey: "s",
      expiresSeconds: 60,
      now: new Date("2026-01-01T00:00:00Z")
    });
    expect(url.startsWith("https://s3.example.com/bucket/1/a%20b/%D1%91.wav?")).toBe(true);
  });

  it("puts extra signed headers into SignedHeaders (sorted) and changes the signature", () => {
    const base = {
      method: "PUT" as const,
      host: "s3.example.com",
      path: "/bucket/a.wav",
      region: "r",
      accessKeyId: "k",
      secretAccessKey: "s",
      expiresSeconds: 600,
      now: new Date("2026-01-01T00:00:00Z")
    };
    const plain = presignS3Url(base);
    const sized = presignS3Url({
      ...base,
      signedHeaders: { "Content-Type": "audio/wav", "content-length": "1234" }
    });
    const other = presignS3Url({
      ...base,
      signedHeaders: { "content-type": "audio/wav", "content-length": "9999" }
    });
    expect(sized).toContain("X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost");
    const sig = (u: string) => u.split("X-Amz-Signature=")[1];
    expect(sig(sized)).not.toBe(sig(plain));
    expect(sig(sized)).not.toBe(sig(other));
  });
});
