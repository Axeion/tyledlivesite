/**
 * Local S3-compatible object store (s3rver) standing in for MinIO when Docker
 * is not available. Objects live under .local/s3.
 */
import path from "node:path";
import S3rver from "s3rver";

export async function startMockS3(opts: { port?: number; bucket?: string; directory?: string } = {}) {
  const port = opts.port ?? Number(process.env.MOCK_S3_PORT ?? 4569);
  const bucket = opts.bucket ?? process.env.S3_BUCKET ?? "tyled-uploads";
  const directory = opts.directory ?? path.resolve(process.cwd(), ".local/s3");
  const server = new S3rver({
    port,
    address: "127.0.0.1",
    silent: true,
    directory,
    resetOnClose: false,
    allowMismatchedSignatures: true,
    configureBuckets: [{ name: bucket, configs: [] }],
  });
  await server.run();
  console.log(`[mock-s3] listening on http://127.0.0.1:${port} bucket=${bucket} dir=${directory}`);
  return { server, port, bucket };
}

if (process.argv[1] && /mocks[\\/]s3\.ts$/.test(process.argv[1])) {
  startMockS3();
}
