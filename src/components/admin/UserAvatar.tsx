import type { User } from '@/payload-types'

// Matches the fixed 25x25 size of Payload's default account SVG icon
// (@payloadcms/ui/graphics/Account/Default) — the header link has no intrinsic size of its
// own, so without a fixed box here the image would stretch to fill it.
const SIZE = 25

// Rendered in the admin header and on /admin/account in place of Payload's default/gravatar
// icon. Falls back to the same icon when the signed-in user has no synced Workspace photo.
export function UserAvatar({ user }: { user?: (User & { collection: 'users' }) | null }) {
  if (!user?.image) {
    return (
      <div
        style={{
          alignItems: 'center',
          background: 'var(--theme-elevation-150)',
          borderRadius: '50%',
          display: 'flex',
          height: SIZE,
          justifyContent: 'center',
          width: SIZE,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
          {(user?.name?.trim()?.[0] || user?.email?.[0] || '?').toUpperCase()}
        </span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      height={SIZE}
      src={user.image}
      style={{ borderRadius: '50%', objectFit: 'cover' }}
      width={SIZE}
    />
  )
}
