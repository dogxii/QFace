import { markdown } from '@codemirror/lang-markdown'
import { LanguageDescription } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { githubDark } from '@uiw/codemirror-theme-github'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { type RefObject, useMemo } from 'react'

const codeLanguages = [
  LanguageDescription.of({
    name: 'JavaScript',
    alias: ['js', 'jsx'],
    load: () =>
      import('@codemirror/lang-javascript').then(({ javascript }) => javascript({ jsx: true })),
  }),
  LanguageDescription.of({
    name: 'TypeScript',
    alias: ['ts', 'tsx'],
    load: () =>
      import('@codemirror/lang-javascript').then(({ javascript }) =>
        javascript({ jsx: true, typescript: true }),
      ),
  }),
  LanguageDescription.of({
    name: 'JSON',
    load: () => import('@codemirror/lang-json').then(({ json }) => json()),
  }),
  LanguageDescription.of({
    name: 'CSS',
    load: () => import('@codemirror/lang-css').then(({ css }) => css()),
  }),
  LanguageDescription.of({
    name: 'Python',
    alias: ['py'],
    load: () => import('@codemirror/lang-python').then(({ python }) => python()),
  }),
  LanguageDescription.of({
    name: 'Java',
    load: () => import('@codemirror/lang-java').then(({ java }) => java()),
  }),
  LanguageDescription.of({
    name: 'Go',
    alias: ['golang'],
    load: () => import('@codemirror/lang-go').then(({ go }) => go()),
  }),
  LanguageDescription.of({
    name: 'C++',
    alias: ['c', 'cpp'],
    load: () => import('@codemirror/lang-cpp').then(({ cpp }) => cpp()),
  }),
  LanguageDescription.of({
    name: 'SQL',
    load: () => import('@codemirror/lang-sql').then(({ sql }) => sql()),
  }),
]

export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  editorRef,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  editorRef: RefObject<ReactCodeMirrorRef | null>
}) {
  const extensions = useMemo(() => [markdown({ codeLanguages }), EditorView.lineWrapping], [])

  return (
    <CodeMirror
      ref={editorRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      theme={githubDark}
      extensions={extensions}
      basicSetup={{
        foldGutter: false,
        highlightActiveLine: true,
      }}
      className="markdown-code-editor"
    />
  )
}
