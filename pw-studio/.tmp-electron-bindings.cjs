for (const name of ['electron_browser_app','electron_browser_window','electron_common_shell','electron_browser_dialog','electron_browser_web_contents']) {
  try {
    const value = process._linkedBinding(name)
    console.log(name, typeof value, value && Object.keys(value))
  } catch (error) {
    console.error('ERR', name, error && error.message)
  }
}
process.exit(0)
