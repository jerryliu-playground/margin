// Vite's ?inline import: the stylesheet as a string, so the panel can render its own <style>.
declare module '*.css?inline' {
  const css: string;
  export default css;
}
