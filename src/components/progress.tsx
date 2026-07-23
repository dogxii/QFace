import { useState } from 'react'

const masteryValues = [1, 2, 3]

export function MasteryStars({
  sourceId,
  value,
  onChange,
}: {
  sourceId: string
  value: number
  onChange: (sourceId: string, value: number) => void
}) {
  const [previewValue, setPreviewValue] = useState(0)
  const displayValue = previewValue || value

  return (
    <fieldset
      className="mastery-stars"
      aria-label={`掌握度 ${value}/3`}
      title={`掌握度 ${value}/3`}
      onMouseLeave={() => setPreviewValue(0)}
    >
      {masteryValues.map((item) => (
        <button
          className="mastery-star"
          data-active={displayValue >= item ? 'true' : undefined}
          data-selected={value >= item ? 'true' : undefined}
          type="button"
          onFocus={() => setPreviewValue(item)}
          onPointerEnter={() => setPreviewValue(item)}
          onClick={() => onChange(sourceId, value === item ? 0 : item)}
          aria-label={`标记 ${item} 星掌握度`}
          key={item}
        >
          ★
        </button>
      ))}
    </fieldset>
  )
}
