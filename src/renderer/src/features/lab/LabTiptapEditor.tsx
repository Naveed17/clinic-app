import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Button, Tooltip, makeStyles } from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { labTableExtensions } from './labTiptapTable';
import {
  FormatBoldIcon,
  FormatItalicIcon,
  FormatListBulletedIcon,
  FormatListNumberedIcon,
  HorizontalRuleIcon,
  RedoIcon,
  TableChartOutlinedIcon,
  TitleOutlinedIcon,
  UndoIcon,
} from '@/icons/fluent';

const INK = '#0f172a';
const BLUE = '#1a6fa8';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    flex: 1,
  },
  toolbar: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '2px',
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingTop: '4px',
    paddingBottom: '4px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
  },
  editor: {
    flex: 1,
    overflow: 'auto',
    paddingLeft: '20px',
    paddingRight: '20px',
    paddingTop: '16px',
    paddingBottom: '16px',
    backgroundColor: '#fff',
  },
});

interface LabTiptapEditorProps {
  content: string;
  revision: number;
  onEditor: (editor: Editor | null) => void;
  minHeight?: number;
}

export function LabTiptapEditor({
  content,
  revision,
  onEditor,
  minHeight = 420,
}: LabTiptapEditorProps): React.JSX.Element {
  const styles = useStyles();
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      ...labTableExtensions,
    ],
    content: content || '<p></p>',
    immediatelyRender: false,
  });

  const [, setTick] = useState(0);

  useEffect(() => {
    onEditor(editor);
    return () => onEditor(null);
  }, [editor, onEditor]);

  useEffect(() => {
    if (!editor) return;
    const bump = () => setTick((n) => n + 1);
    editor.on('transaction', bump);
    return () => {
      editor.off('transaction', bump);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor || revision === 0) return;
    editor.commands.setContent(content || '<p></p>', { emitUpdate: false });
  }, [content, editor, revision]);

  const tools = [
    {
      title: 'Heading',
      icon: <TitleOutlinedIcon style={{ fontSize: 18 }} />,
      run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
      active: editor?.isActive('heading', { level: 3 }),
    },
    {
      title: 'Bold',
      icon: <FormatBoldIcon style={{ fontSize: 18 }} />,
      run: () => editor?.chain().focus().toggleBold().run(),
      active: editor?.isActive('bold'),
    },
    {
      title: 'Italic',
      icon: <FormatItalicIcon style={{ fontSize: 18 }} />,
      run: () => editor?.chain().focus().toggleItalic().run(),
      active: editor?.isActive('italic'),
    },
    {
      title: 'Bullets',
      icon: <FormatListBulletedIcon style={{ fontSize: 18 }} />,
      run: () => editor?.chain().focus().toggleBulletList().run(),
      active: editor?.isActive('bulletList'),
    },
    {
      title: 'Numbers',
      icon: <FormatListNumberedIcon style={{ fontSize: 18 }} />,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
      active: editor?.isActive('orderedList'),
    },
    {
      title: 'Insert table',
      icon: <TableChartOutlinedIcon style={{ fontSize: 18 }} />,
      run: () => editor?.chain().focus().insertLabTable(4, 4).run(),
    },
    {
      title: 'Divider',
      icon: <HorizontalRuleIcon style={{ fontSize: 18 }} />,
      run: () => editor?.chain().focus().setHorizontalRule().run(),
    },
    {
      title: 'Undo',
      icon: <UndoIcon style={{ fontSize: 18 }} />,
      run: () => editor?.chain().focus().undo().run(),
    },
    {
      title: 'Redo',
      icon: <RedoIcon style={{ fontSize: 18 }} />,
      run: () => editor?.chain().focus().redo().run(),
    },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        {tools.map((tool) => (
          <Tooltip key={tool.title} content={tool.title} relationship="label">
            <Button
              appearance="subtle"
              size="small"
              disabled={!editor}
              icon={tool.icon}
              onClick={tool.run}
              style={{ color: tool.active ? BLUE : '#64748b' }}
            />
          </Tooltip>
        ))}
      </div>
      <div className={styles.editor} style={{ minHeight }}>
        <style>{`
          .lab-tiptap-root .ProseMirror {
            outline: none;
            min-height: ${minHeight}px;
            font-size: 14px;
            line-height: 1.65;
            color: ${INK} !important;
            caret-color: ${BLUE};
          }
          .lab-tiptap-root .ProseMirror p { margin: 0 0 8px; }
          .lab-tiptap-root .ProseMirror h2 { font-size: 20px; font-weight: 800; color: ${BLUE} !important; margin: 0 0 6px; }
          .lab-tiptap-root .ProseMirror h3 {
            font-size: 13.5px; font-weight: 800; letter-spacing: 0.4px;
            text-transform: uppercase; color: ${BLUE} !important; margin: 16px 0 6px;
          }
          .lab-tiptap-root .ProseMirror ul, .lab-tiptap-root .ProseMirror ol { padding-left: 22px; margin: 8px 0; }
          .lab-tiptap-root .ProseMirror strong { font-weight: 700; }
          .lab-tiptap-root .ProseMirror .lab-tiptap-table,
          .lab-tiptap-root .ProseMirror table {
            width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 13px;
          }
          .lab-tiptap-root .ProseMirror th,
          .lab-tiptap-root .ProseMirror td {
            border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top;
          }
          .lab-tiptap-root .ProseMirror th {
            background: #e8f1f8; color: ${BLUE}; font-weight: 800; text-align: left;
            font-size: 11.5px; letter-spacing: 0.3px; text-transform: uppercase;
          }
          .lab-tiptap-root .ProseMirror th p,
          .lab-tiptap-root .ProseMirror td p { margin-bottom: 0; }
        `}</style>
        <div className="lab-tiptap-root">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
