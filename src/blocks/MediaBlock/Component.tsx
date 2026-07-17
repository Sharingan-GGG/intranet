import type { StaticImageData } from 'next/image'

import { cn } from '@/utilities/ui'
import React from 'react'
import RichText from '@/components/RichText'

import type { MediaBlock as MediaBlockProps } from '@/payload-types'

import { Media } from '../../components/Media'

type Props = MediaBlockProps & {
  breakout?: boolean
  captionClassName?: string
  className?: string
  enableGutter?: boolean
  imgClassName?: string
  staticImage?: StaticImageData
  disableInnerContainer?: boolean
}

export const MediaBlock: React.FC<Props> = (props) => {
  const {
    captionClassName,
    className,
    enableGutter = true,
    imgClassName,
    media,
    staticImage,
    disableInnerContainer,
  } = props

  const items = Array.isArray(media) ? media : media ? [media] : []

  return (
    <div
      className={cn(
        '',
        {
          container: enableGutter,
        },
        className,
      )}
    >
      {items.length === 0 && staticImage && (
        <Media
          imgClassName={cn('border border-border rounded-[0.8rem]', imgClassName)}
          src={staticImage}
        />
      )}
      <div className={cn({ 'grid grid-cols-1 gap-4 md:grid-cols-2': items.length > 1 })}>
        {items.map((item, i) => {
          const caption = item && typeof item === 'object' ? item.caption : undefined
          return (
            <figure key={typeof item === 'object' ? item.id : i} className="m-0">
              <Media
                imgClassName={cn('border border-border rounded-[0.8rem]', imgClassName)}
                resource={item}
              />
              {caption && (
                <div
                  className={cn(
                    'mt-6',
                    {
                      container: !disableInnerContainer,
                    },
                    captionClassName,
                  )}
                >
                  <RichText data={caption} enableGutter={false} />
                </div>
              )}
            </figure>
          )
        })}
      </div>
    </div>
  )
}
