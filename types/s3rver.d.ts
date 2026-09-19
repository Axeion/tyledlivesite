declare module "s3rver" {
  interface S3rverOptions {
    port?: number;
    address?: string;
    silent?: boolean;
    directory: string;
    resetOnClose?: boolean;
    allowMismatchedSignatures?: boolean;
    configureBuckets?: { name: string; configs?: unknown[] }[];
  }
  class S3rver {
    constructor(options: S3rverOptions);
    run(): Promise<{ address: string; port: number }>;
    close(): Promise<void>;
  }
  export = S3rver;
}
