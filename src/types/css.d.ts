// Type declarations for CSS modules used by template components
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
