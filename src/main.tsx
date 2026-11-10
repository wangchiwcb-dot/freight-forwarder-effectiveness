import '@ant-design/v5-patch-for-react-19';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import App from './App';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import 'antd/dist/reset.css';
import './styles.css';

dayjs.locale('zh-cn');
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 0, refetchOnWindowFocus: true } },
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#175b73',
          colorInfo: '#175b73',
          colorText: '#172f40',
          colorTextSecondary: '#70828c',
          borderRadius: 7,
          fontFamily:
            '"DM Sans", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
          controlHeight: 38,
        },
        components: {
          Button: { primaryShadow: 'none' },
          Select: { optionSelectedBg: '#eaf3f5' },
          DatePicker: { activeShadow: '0 0 0 2px #eaf3f5' },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
