declare module "pagedjs" {
  export type PaginationFlow = {
    total: number;
  };

  export class Previewer {
    polisher: {
      styleEl?: HTMLStyleElement;
      destroy(): void;
    };

    preview(
      content: string,
      stylesheets: Array<string | Record<string, string>>,
      renderTo: HTMLElement,
    ): Promise<PaginationFlow>;
  }
}
