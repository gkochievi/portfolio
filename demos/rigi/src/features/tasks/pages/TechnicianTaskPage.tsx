import { useParams } from 'react-router-dom'

import { TaskWorkspace } from '../components/TaskWorkspace'

/** /technician/tasks/:taskId: the same workspace in technician mode. */
export default function TechnicianTaskPage() {
  const { taskId = '' } = useParams()
  return <TaskWorkspace taskId={taskId} mode="technician" />
}
