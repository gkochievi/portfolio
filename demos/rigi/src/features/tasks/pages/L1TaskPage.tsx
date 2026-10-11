import { useParams } from 'react-router-dom'

import { TaskWorkspace } from '../components/TaskWorkspace'

/** /l1/tasks/:taskId: the task workspace in desk mode. */
export default function L1TaskPage() {
  const { taskId = '' } = useParams()
  return <TaskWorkspace taskId={taskId} mode="l1" />
}
