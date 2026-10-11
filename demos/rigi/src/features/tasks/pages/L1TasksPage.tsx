import { TaskListView } from '../components/TaskListView'

/** /l1/tasks: the staff task queue (filters in the URL, CSV export). */
export default function L1TasksPage() {
  return <TaskListView area="l1" />
}
