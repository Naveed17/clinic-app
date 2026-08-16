import '@tanstack/react-query';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      toast?: string;
      errorToast?: string | false;
      silent?: boolean;
    };
  }
}
