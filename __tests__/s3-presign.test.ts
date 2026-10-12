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
});
