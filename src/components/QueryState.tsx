import { Alert, Button, Skeleton } from 'antd';
export function QueryState({ error, retry }: { error?: Error | null; retry?: () => unknown }) {
  return (
    <section className="query-state" aria-live="polite">
      {error ? (
        <Alert
          type="error"
          showIcon
          message="暂时无法获取时效数据"
          description={error.message}
          action={<Button onClick={() => retry?.()}>重试</Button>}
        />
      ) : (
        <>
          <p>正在加载时效数据…</p>
          <Skeleton active paragraph={{ rows: 5 }} />
        </>
      )}
    </section>
  );
}
