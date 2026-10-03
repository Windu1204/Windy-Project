import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests',testMatch:'browser.spec.ts',timeout:60000,use:{baseURL:'http://127.0.0.1:5173',headless:true,channel:'chrome'},reporter:'list'});
