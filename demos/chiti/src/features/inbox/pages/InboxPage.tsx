import { InboxWorkspace } from '../InboxWorkspace'

/** `/operator`: the operator inbox. The operator layout supplies the top bar and the full remaining height. */
export default function InboxPage() {
  return (
    <div className="h-full min-h-0">
      <InboxWorkspace />
    </div>
  )
}
