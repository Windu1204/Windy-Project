import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
export const themes=['tosca','blue','pink','gray','yellow'] as const;
export type Theme=typeof themes[number];
export const themeNames:Record<Theme,string>={tosca:'Tosca',blue:'Biru Muda',pink:'Pink',gray:'Abu-abu',yellow:'Kuning'};
const ThemeContext=createContext<{theme:Theme;setTheme:(value:Theme)=>void}>({theme:'tosca',setTheme:()=>{}});
export function ThemeProvider({userId,children}:{userId:string;children:ReactNode}){
 const key='wci-theme:'+userId;
 const [theme,setTheme]=useState<Theme>('tosca');
 useEffect(()=>{try{const saved=localStorage.getItem(key);setTheme(themes.includes(saved as Theme)?saved as Theme:'tosca');}catch{setTheme('tosca');}},[key]);
 const select=(value:Theme)=>{setTheme(value);try{localStorage.setItem(key,value);}catch{/* Theme stays usable when browser storage is unavailable. */}};
 return <ThemeContext.Provider value={{theme,setTheme:select}}><div className="theme-root" data-theme={theme}>{children}</div></ThemeContext.Provider>;
}
export const useTheme=()=>useContext(ThemeContext);
