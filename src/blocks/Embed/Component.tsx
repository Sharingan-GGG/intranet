import React from 'react'

export type EmbedBlockProps = {
  url: string
  title: string
  aspectRatio?: '16/9' | '4/3' | '1/1' | null
  blockType: 'embed'
}

type Props = EmbedBlockProps & {
  className?: string
}

const aspectRatioClasses: Record<string, string> = {
  '16/9': 'aspect-video',
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
}

export const EmbedBlock: React.FC<Props> = ({ className, url, title, aspectRatio }) => {
  if (!url) return null

  return (
    <div className={[className, 'not-prose'].filter(Boolean).join(' ')}>
      <p className="mb-2 font-medium">{title}</p>
      <div
        className={[
          'relative w-full overflow-hidden rounded border border-border',
          aspectRatioClasses[aspectRatio || '16/9'],
        ].join(' ')}
      >
        <iframe
          src={url}
          title={title}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          allowFullScreen
        />
      </div>
    </div>
  )
}
