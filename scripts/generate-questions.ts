import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const categoryNames: Record<string, string> = {
  frontend: '前端',
  'ai-agent': 'AI Agent',
  golang: 'Golang',
  java: 'Java',
}

const sourceQuestionSchema = z.object({
  id: z.string().trim().min(1),
  module: z.string().trim().min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  question: z.string().trim().min(1),
  answer: z.string().min(1),
  tags: z.array(z.string()),
  source: z.string().optional(),
})

interface GeneratedQuestion {
  sourceId: string
  category: string
  module: string
  difficulty: 1 | 2 | 3
  title: string
  tags: string[]
  source?: string
  contentHash: string
}

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.resolve(
  process.env.IFACE_QUESTIONS_DIR ?? path.join(workspaceRoot, '../iFace/public/questions'),
)
const outputPath = path.join(workspaceRoot, 'src/generated/questions.json')

function hashQuestion(question: Omit<GeneratedQuestion, 'contentHash'>) {
  return createHash('sha256').update(JSON.stringify(question)).digest('hex')
}

async function loadQuestions() {
  const directories = await readdir(sourceRoot, { withFileTypes: true })
  const questions: GeneratedQuestion[] = []
  const ids = new Set<string>()

  for (const directory of directories.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!directory.isDirectory()) continue

    const category = categoryNames[directory.name]
    if (!category) {
      throw new Error(`未识别的题目分类目录：${directory.name}`)
    }

    const categoryPath = path.join(sourceRoot, directory.name)
    const files = (await readdir(categoryPath)).filter((file) => file.endsWith('.json')).sort()

    for (const file of files) {
      const filePath = path.join(categoryPath, file)
      const raw = JSON.parse(await readFile(filePath, 'utf8')) as unknown
      const parsed = z.array(sourceQuestionSchema).safeParse(raw)

      if (!parsed.success) {
        throw new Error(`${filePath} 校验失败：${z.prettifyError(parsed.error)}`)
      }

      for (const item of parsed.data) {
        if (ids.has(item.id)) {
          throw new Error(`发现重复题目 ID：${item.id}`)
        }
        ids.add(item.id)

        // Deliberately construct a new object. The iFace `answer` field must never enter QFace.
        const publicQuestion = {
          sourceId: item.id,
          category,
          module: item.module,
          difficulty: item.difficulty,
          title: item.question,
          tags: [...new Set(item.tags.map((tag) => tag.trim()).filter(Boolean))],
          ...(item.source?.trim() ? { source: item.source.trim() } : {}),
        }

        questions.push({
          ...publicQuestion,
          contentHash: hashQuestion(publicQuestion),
        })
      }
    }
  }

  return questions
}

function serialize(questions: GeneratedQuestion[]) {
  const categories = Object.values(categoryNames).map((name) => ({
    name,
    count: questions.filter((question) => question.category === name).length,
  }))

  return `${JSON.stringify(
    {
      source: 'iface',
      sourceVersion: '0.18.0',
      count: questions.length,
      categories,
      questions,
    },
    null,
    2,
  )}\n`
}

const questions = await loadQuestions()
const generated = serialize(questions)

if (questions.length !== 1222) {
  throw new Error(`预期导入 1222 道题，实际得到 ${questions.length} 道`)
}

if (process.argv.includes('--check')) {
  const current = await readFile(outputPath, 'utf8').catch(() => '')
  if (current !== generated) {
    throw new Error('生成题库已过期，请执行 bun run content:generate')
  }
  console.log(`题库校验通过：${questions.length} 道题，未包含 answer 字段`)
} else {
  await writeFile(outputPath, generated)
  console.log(`已生成 ${questions.length} 道题：${outputPath}`)
}
