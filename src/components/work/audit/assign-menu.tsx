'use client'

import { Loader2, UserPlus } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { updateTrackerAssigned } from '@/app/audit/actions'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Assignee, Team } from '@/lib/audit-types'
import { TEAM_LABELS } from '@/lib/audit-types'

/**
 * Assign a page to people, grouped by team.
 *
 * Uses `DropdownMenuCheckboxItem` with `onSelect` prevented, which is the
 * supported way to keep a Radix menu open across several picks — assigning a
 * page to two people at once is the normal case, and the earlier version's
 * plain buttons fought the menu's own focus and dismiss handling.
 *
 * Selection is applied optimistically so ticking feels immediate; a rejected
 * write rolls the local copy back and says why.
 */
export function AssignMenu({
  trackerId,
  assigned,
  roster,
  disabled,
}: {
  trackerId: string
  assigned: string[]
  roster: Assignee[]
  disabled?: boolean
}) {
  const [selected, setSelected] = useState<string[]>(assigned)
  const [pending, startTransition] = useTransition()

  // A server refresh (or another user's change) is the source of truth; resync
  // when the row's assignees come back different.
  useEffect(() => {
    setSelected(assigned)
  }, [assigned])

  function save(next: string[]) {
    const previous = selected
    setSelected(next)
    startTransition(async () => {
      const result = await updateTrackerAssigned(trackerId, next)
      if (!result.ok) {
        setSelected(previous)
        toast.error(result.error)
      }
    })
  }

  const toggle = (email: string) =>
    save(selected.includes(email) ? selected.filter((e) => e !== email) : [...selected, email])

  const names = roster
    .filter((r) => selected.includes(r.email))
    .map((r) => r.name)
    .sort((a, b) => a.localeCompare(b))

  const label =
    names.length === 0 ? 'Assign' : names.length <= 2 ? names.join(', ') : `${names.length} people`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button className="audit-assign__trigger btn btn-sm" type="button" title={names.join(', ')}>
          {pending ? (
            <Loader2 className="animate-spin" size={13} aria-hidden />
          ) : (
            <UserPlus size={13} aria-hidden />
          )}
          <span className="audit-assign__label">{label}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="audit-assign__menu w-56">
        {(['marketing', 'it'] as Team[]).map((team, index) => {
          const members = roster.filter((r) => r.team === team)
          if (!members.length) return null
          return (
            <div key={team} className={`audit-assign__group audit-assign__group--${team}`}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{TEAM_LABELS[team]}</DropdownMenuLabel>
              {members.map((member) => (
                <DropdownMenuCheckboxItem
                  key={member.email}
                  className="audit-assign__option"
                  checked={selected.includes(member.email)}
                  // Keep the menu open: assigning two people at once is normal.
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={() => toggle(member.email)}
                >
                  {member.name}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          )
        })}

        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="audit-assign__clear"
              onSelect={(event) => {
                event.preventDefault()
                save([])
              }}
            >
              Clear assignment
            </DropdownMenuItem>
          </>
        )}

        {!roster.length && (
          <DropdownMenuLabel className="audit-assign__empty font-normal">
            Nobody in the Marketing or IT departments yet.
          </DropdownMenuLabel>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
