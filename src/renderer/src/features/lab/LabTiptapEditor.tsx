import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import RedoIcon from '@mui/icons-material/Redo';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import TitleOutlinedIcon from '@mui/icons-material/TitleOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import { Box, IconButton, Stack, Tooltip } from '@mui/material';
import { useEffect, useState } from 'react';
import { labTableExtensions } from './labTiptapTable';

const INK = '#0f172a';
const BLUE = '#1a6fa8';

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
      icon: <TitleOutlinedIcon fontSize="small" />,
      run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
      active: editor?.isActive('heading', { level: 3 }),
    },
    {
      title: 'Bold',
      icon: <FormatBoldIcon fontSize="small" />,
      run: () => editor?.chain().focus().toggleBold().run(),
      active: editor?.isActive('bold'),
    },
    {
      title: 'Italic',
      icon: <FormatItalicIcon fontSize="small" />,
      run: () => editor?.chain().focus().toggleItalic().run(),
      active: editor?.isActive('italic'),
    },
    {
      title: 'Bullets',
      icon: <FormatListBulletedIcon fontSize="small" />,
      run: () => editor?.chain().focus().toggleBulletList().run(),
      active: editor?.isActive('bulletList'),
    },
    {
      title: 'Numbers',
      icon: <FormatListNumberedIcon fontSize="small" />,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
      active: editor?.isActive('orderedList'),
    },
    {
      title: 'Insert table',
      icon: <TableChartOutlinedIcon fontSize="small" />,
      run: () => editor?.chain().focus().insertLabTable(4, 4).run(),
    },
    {
      title: 'Divider',
      icon: <HorizontalRuleIcon fontSize="small" />,
      run: () => editor?.chain().focus().setHorizontalRule().run(),
    },
    {
      title: 'Undo',
      icon: <UndoIcon fontSize="small" />,
      run: () => editor?.chain().focus().undo().run(),
    },
    {
      title: 'Redo',
      icon: <RedoIcon fontSize="small" />,
      run: () => editor?.chain().focus().redo().run(),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <Stack
        direction="row"
        spacing={0.25}
        sx={{
          px: 1,
          py: 0.5,
          borderBottom: '1px solid #e2e8f0',
          bgcolor: '#f8fafc',
          flexWrap: 'wrap',
        }}
      >
        {tools.map((tool) => (
          <Tooltip key={tool.title} title={tool.title}>
            <span>
              <IconButton
                size="small"
                disabled={!editor}
                onClick={tool.run}
                sx={{ color: tool.active ? BLUE : '#64748b' }}
              >
                {tool.icon}
              </IconButton>
            </span>
          </Tooltip>
        ))}
      </Stack>
      <Box
        sx={{
          flex: 1,
          minHeight,
          overflow: 'auto',
          px: 2.5,
          py: 2,
          bgcolor: '#fff',
          '& .ProseMirror': {
            outline: 'none',
            minHeight,
            fontSize: 14,
            lineHeight: 1.65,
            color: `${INK} !important`,
            caretColor: BLUE,
            '& p': { m: 0, mb: 1 },
            '& h2': { fontSize: 20, fontWeight: 800, color: `${BLUE} !important`, mt: 0, mb: 0.75 },
            '& h3': {
              fontSize: 13.5,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: `${BLUE} !important`,
              mt: 2,
              mb: 0.75,
            },
            '& ul, & ol': { pl: 2.75, my: 1 },
            '& strong': { fontWeight: 700 },
            '& .lab-tiptap-table, & table': {
              width: '100%',
              borderCollapse: 'collapse',
              margin: '8px 0 16px',
              fontSize: 13,
            },
            '& th, & td': {
              border: '1px solid #cbd5e1',
              padding: '6px 8px',
              verticalAlign: 'top',
            },
            '& th': {
              background: '#e8f1f8',
              color: BLUE,
              fontWeight: 800,
              textAlign: 'left',
              fontSize: 11.5,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
            },
            '& th p, & td p': { mb: 0 },
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
