-- Keep revenue task joins and FK checks fast as the command center grows.
create index if not exists revenue_pipeline_tasks_approval_queue_idx
  on public.revenue_pipeline_tasks (approval_queue_id)
  where approval_queue_id is not null;

create index if not exists revenue_pipeline_tasks_completed_by_idx
  on public.revenue_pipeline_tasks (completed_by)
  where completed_by is not null;;
