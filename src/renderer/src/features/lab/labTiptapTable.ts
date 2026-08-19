import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    labTable: {
      insertLabTable: (rows?: number, cols?: number) => ReturnType;
    };
  }
}

export const LabTable = Node.create({
  name: 'table',
  group: 'block',
  content: 'tableRow+',
  isolating: true,

  parseHTML() {
    return [{ tag: 'table' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['table', mergeAttributes({ class: 'lab-tiptap-table' }, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      insertLabTable:
        (rows = 3, cols = 4) =>
        ({ commands }) => {
          const header = `<tr>${Array.from({ length: cols }, (_, i) => `<th><p>${i === 0 ? 'Parameter' : `Col ${i}`}</p></th>`).join('')}</tr>`;
          const body = Array.from({ length: Math.max(1, rows - 1) }, () => {
            return `<tr>${Array.from({ length: cols }, () => '<td><p></p></td>').join('')}</tr>`;
          }).join('');
          return commands.insertContent(`<table>${header}${body}</table>`);
        },
    };
  },
});

export const LabTableRow = Node.create({
  name: 'tableRow',
  content: '(tableCell | tableHeader)*',

  addAttributes() {
    return {
      background: {
        default: null,
        parseHTML: (element) =>
          (element as HTMLElement).style?.backgroundColor || element.getAttribute('data-bg'),
        renderHTML: (attrs) =>
          attrs.background
            ? { style: `background-color: ${attrs.background}`, 'data-bg': attrs.background }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'tr' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['tr', mergeAttributes(HTMLAttributes), 0];
  },
});

const cellAttributes = {
  background: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) =>
      element.style?.backgroundColor || element.getAttribute('data-bg'),
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.background
        ? { style: `background-color: ${String(attrs.background)}`, 'data-bg': String(attrs.background) }
        : {},
  },
  colspan: {
    default: 1,
    parseHTML: (element: HTMLElement) => {
      const value = Number.parseInt(element.getAttribute('colspan') || '1', 10);
      return Number.isFinite(value) && value > 1 ? value : 1;
    },
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.colspan && Number(attrs.colspan) > 1 ? { colspan: attrs.colspan } : {},
  },
};

export const LabTableHeader = Node.create({
  name: 'tableHeader',
  content: 'block+',
  addAttributes() {
    return cellAttributes;
  },
  parseHTML() {
    return [{ tag: 'th' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['th', mergeAttributes(HTMLAttributes), 0];
  },
});

export const LabTableCell = Node.create({
  name: 'tableCell',
  content: 'block+',
  addAttributes() {
    return cellAttributes;
  },
  parseHTML() {
    return [{ tag: 'td' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['td', mergeAttributes(HTMLAttributes), 0];
  },
});

export const labTableExtensions = [LabTable, LabTableRow, LabTableHeader, LabTableCell];
