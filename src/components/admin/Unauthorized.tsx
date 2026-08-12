import type { AdminViewServerProps } from 'payload'

import { Button, Gutter } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import React from 'react'

const baseClass = 'unauthorized'

export function Unauthorized({ initPageResult }: AdminViewServerProps) {
  const {
    permissions,
    req: {
      i18n,
      payload: {
        config: {
          admin: {
            routes: { logout: logoutRoute },
          },
          routes: { admin: adminRoute },
        },
      },
      user,
    },
  } = initPageResult

  return (
    <Gutter className={[baseClass, `${baseClass}--with-gutter`].join(' ')}>
      <div className={baseClass}>
        <div className="form-header">
          <h1>
            {i18n.t(
              user && !permissions.canAccessAdmin ? 'error:unauthorizedAdmin' : 'error:unauthorized',
            )}
          </h1>
          <p>{i18n.t('error:notAllowedToAccessPage')}</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button className={`${baseClass}__button`} el="link" size="large" to="/">
            Home Page
          </Button>
          <Button
            className={`${baseClass}__button`}
            el="link"
            size="large"
            to={formatAdminURL({ adminRoute, path: logoutRoute })}
          >
            {i18n.t('authentication:logOut')}
          </Button>
        </div>
      </div>
    </Gutter>
  )
}
