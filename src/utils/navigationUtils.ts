export interface NavigationItem {
  label: string;
  to?: string;
}

export const getPrimaryNavItems = (): Required<NavigationItem>[] => [
  { label: "书库", to: "/" },
  { label: "阅读历史", to: "/history" },
];

export const getLibraryBreadcrumb = (libraryName: string): NavigationItem[] => [
  { label: "书库", to: "/" },
  { label: libraryName },
];
