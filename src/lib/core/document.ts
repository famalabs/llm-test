export interface Document<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>
> {
  pageContent: string;

  source?: string;

  metadata: Metadata;

  id?: string;
}

