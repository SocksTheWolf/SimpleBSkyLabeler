function clearResult() {
  document.getElementById("form-output").innerHTML = "";
}
const bskyHandleEl = document.getElementById("username");
const addForm = document.getElementById("addform");
if (bskyHandleEl !== null && addForm !== null) {
  bskyHandleEl.value = "";
  bskyHandleEl.addEventListener("paste", ev => {
    ev.preventDefault();
    clearResult();

    // regex to clean up URLs
    const linkRegex = /(?:^.*\/profile\/)([0-9a-zA-Z\-\.]+)(?:\/post\/\w+)?(?:\/)?$/gm;

    // Clean any unicode trash that bsky likes to hide near handle names.
    let inputData = ev.clipboardData.getData("text").replace(/[^\x00-\x7F]/g, "").replace("@", "");

    // Convert urls into handles
    var matches = linkRegex.exec(inputData);
    if (matches != null && matches.length >= 2) {
      // was a URL, convert to handle
      bskyHandleEl.value = matches[1];
    } else {
      // was something else, w/e
      bskyHandleEl.value = inputData;
    }
    console.log(`output: ${bskyHandleEl.value}`);
  });
  // clear previous results upon submit
  addForm.addEventListener("submit", () => clearResult);
}