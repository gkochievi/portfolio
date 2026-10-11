import { TaskListView } from '../components/TaskListView'

/** /technician/tasks?tab=mine|unassigned|all */
export default function TechnicianTasksPage() {
  return <TaskListView area="technician" />
}
