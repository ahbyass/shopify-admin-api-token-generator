import { cn } from 'cnfast'
import { useRef, useState, type ChangeEventHandler } from 'react'
import { flushSync } from 'react-dom'

/** Props for the setup URLs and generated token that users can copy. */
type Props = {
  id: string
  label: string
  value: string
  name?: string
  descriptionId?: string
  type?: 'text' | 'url'
  readOnly?: boolean
  required?: boolean
  isSecret?: boolean
  onChange?: ChangeEventHandler<HTMLInputElement>
}

/**
 * CopyField
 * ---------------------------------------------
 * Keeps a copyable URL or token with its clipboard feedback and optional reveal control.
 *
 * @param id - Stable identifier connecting the label to its input.
 * @param label - Accessible field name.
 * @param value - Current URL or generated token.
 * @param name - Submitted field name when the value belongs to the setup form.
 * @param descriptionId - Optional help text associated with the input.
 * @param type - Native input validation; defaults to text.
 * @param readOnly - Prevents editing derived URLs and generated tokens.
 * @param required - Uses native form validation for the callback URL.
 * @param isSecret - Starts tokens masked and enables the reveal button.
 * @param onChange - Updates the editable callback URL in its owning form.
 */
export function CopyField({
  id,
  label,
  value,
  name,
  descriptionId,
  type = 'text',
  readOnly,
  required,
  isSecret = false,
  onChange,
}: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [message, setMessage] = useState('')

  async function handleCopy(): Promise<void> {
    if (!value) {
      setMessage('Enter a URL first.')
      input.current?.focus()
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      setMessage(isSecret ? 'Token copied.' : 'URL copied.')
    } catch {
      // Reveal before selecting so manual copying also works for masked tokens.
      flushSync(() => setIsVisible(true))
      input.current?.focus()
      input.current?.select()
      setMessage('Select and copy the highlighted value with your keyboard.')
    }
  }

  return (
    <>
      <label
        htmlFor={id}
        className="mt-4.5 mb-1.5 block text-[13px] font-semibold"
      >
        {label}
      </label>

      <div className="flex items-center gap-2">
        <input
          ref={input}
          id={id}
          name={name}
          aria-describedby={descriptionId}
          type={isSecret && !isVisible ? 'password' : type}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          required={required}
          autoComplete="off"
          className="
            w-full min-w-0 flex-1 rounded-[7px] border border-input-border bg-surface
            px-3 py-2.75 text-sm leading-[1.6] text-ink focus-visible:outline-2
            focus-visible:outline-offset-3 focus-visible:outline-accent
          "
        />

        {isSecret && (
          <button
            type="button"
            aria-controls={id}
            aria-pressed={isVisible}
            onClick={() => setIsVisible(!isVisible)}
            className="
              cursor-pointer rounded-[7px] border border-line
              bg-surface px-4 py-2.75 text-sm leading-[1.6] font-semibold text-accent
              hover:brightness-112 focus-visible:outline-2 focus-visible:outline-offset-3
              focus-visible:outline-accent
            "
          >
            {isVisible ? 'Hide' : 'Show'}
          </button>
        )}

        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className={cn(
            'cursor-pointer rounded-[7px] border px-4 py-2.75 text-sm leading-[1.6] font-semibold',
            'hover:brightness-112 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent',
            isSecret
              ? 'border-accent bg-accent text-white'
              : 'border-line bg-surface text-accent',
          )}
        >
          Copy
        </button>
      </div>

      <output
        aria-live="polite"
        className="block text-xs leading-[1.6] text-muted"
      >
        {message}
      </output>
    </>
  )
}
