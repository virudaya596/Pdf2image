
    // Configure PDF.js worker (same version as main script)
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.7.570/pdf.worker.min.js";

    const dropZone = document.getElementById("drop-zone");
    const browseBtn = document.getElementById("browse-btn");
    const convertBtn = document.getElementById("convert-btn");
    const pdfInput = document.getElementById("pdf-input");
    const statusText = document.getElementById("status-text");
    const fileInfo = document.getElementById("file-info");
    const imagesGrid = document.getElementById("images-grid");
    const pagesCount = document.getElementById("pages-count");
    const downloadAllBtn = document.getElementById("download-all-btn");

    let selectedFile = null;
    let imagesData = [];

    function setStatus(message, strong = false) {
      statusText.textContent = message;
      if (strong) statusText.classList.add("status-strong");
      else statusText.classList.remove("status-strong");
    }

    function humanFileSize(bytes) {
      if (!bytes && bytes !== 0) return "";
      const thresh = 1024;
      if (bytes < thresh) return bytes + " B";
      const units = ["KB", "MB", "GB", "TB"];
      let u = -1;
      do {
        bytes /= thresh;
        ++u;
      } while (bytes >= thresh && u < units.length - 1);
      return bytes.toFixed(1) + " " + units[u];
    }

    function resetPreview() {
      imagesGrid.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.id = "empty-state";
      empty.innerHTML =
        "Your converted pages will appear here as PNG previews.<br />" +
        "After conversion you can download each page individually or save everything as a ZIP.";
      imagesGrid.appendChild(empty);
      pagesCount.textContent = "0 pages rendered";
      imagesData = [];
      downloadAllBtn.disabled = true;
    }

    function handleFile(file) {
      if (!file) {
        selectedFile = null;
        convertBtn.disabled = true;
        setStatus("Waiting for a PDFâ€¦");
        fileInfo.textContent = "No file selected";
        browseBtn.textContent = "Choose PDF";
        resetPreview();
        return;
      }

      if (file.type !== "application/pdf") {
        setStatus("Please select a valid PDF file.", true);
        fileInfo.textContent = "Invalid file type";
        selectedFile = null;
        convertBtn.disabled = true;
        browseBtn.textContent = "Choose PDF";
        return;
      }

      selectedFile = file;
      convertBtn.disabled = false;
      setStatus("Ready to convert. Tap the button when youâ€™re set.", true);
      fileInfo.textContent = file.name + " Â· " + humanFileSize(file.size);
      browseBtn.textContent = "Replace PDF";
    }

    // File input change
    pdfInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      handleFile(file);
    });

    // Browse button triggers file input
    browseBtn.addEventListener("click", () => {
      pdfInput.click();
    });

    // Drag & drop handlers
    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(
        eventName,
        () => dropZone.classList.add("dragover"),
        false
      );
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(
        eventName,
        () => dropZone.classList.remove("dragover"),
        false
      );
    });

    dropZone.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      const file = dt.files[0];
      handleFile(file);
    });

    // Convert PDF to images
    convertBtn.addEventListener("click", () => {
      if (!selectedFile) {
        setStatus("No PDF selected yet.", true);
        return;
      }

      // Show the ZIP button (but keep disabled until pages are ready)
      downloadAllBtn.style.display = "inline-flex";
      downloadAllBtn.disabled = true;

      convertBtn.disabled = true;
      convertBtn.textContent = "Convertingâ€¦";

      // reset preview
      imagesGrid.innerHTML = "";
      imagesData = [];
      pagesCount.textContent = "Renderingâ€¦";

      const reader = new FileReader();
      reader.onload = async function (e) {
        try {
          const typedArray = new Uint8Array(e.target.result);

          setStatus("Parsing PDFâ€¦");
          const loadingTask = pdfjsLib.getDocument({ data: typedArray });
          const pdf = await loadingTask.promise;

          const numPages = pdf.numPages;
          pagesCount.textContent = numPages + " page" + (numPages > 1 ? "s" : "") + " found";

          for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
            setStatus("Rendering page " + pageNumber + " of " + numPages + "â€¦");

            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 2.0 });

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;

            const dataUrl = canvas.toDataURL("image/png");

            // Store for ZIP
            imagesData.push({ page: pageNumber, dataUrl });

            // Build preview card
            const card = document.createElement("div");
            card.className = "image-card";

            const img = document.createElement("img");
            img.src = dataUrl;
            img.alt = "Page " + pageNumber;

            const captionRow = document.createElement("div");
            captionRow.className = "image-caption";

            const leftWrapper = document.createElement("div");
            leftWrapper.style.display = "flex";
            leftWrapper.style.alignItems = "center";
            leftWrapper.style.gap = "6px";

            const pageLabel = document.createElement("span");
            pageLabel.textContent = "Page " + pageNumber;

            const tag = document.createElement("span");
            tag.className = "page-tag";
            tag.textContent = "PNG";

            leftWrapper.appendChild(pageLabel);
            leftWrapper.appendChild(tag);

            const dl = document.createElement("a");
            dl.href = dataUrl;
            dl.download = "page-" + pageNumber + ".png";
            dl.textContent = "Download";
            dl.className = "download-btn";

            captionRow.appendChild(leftWrapper);
            captionRow.appendChild(dl);

            card.appendChild(img);
            card.appendChild(captionRow);

            imagesGrid.appendChild(card);
          }

          setStatus(
            "Done. Converted " + numPages + " page" + (numPages > 1 ? "s" : "") + ".",
            true
          );
          pagesCount.textContent =
            numPages + " page" + (numPages > 1 ? "s" : "") + " rendered";
          downloadAllBtn.disabled = imagesData.length === 0;
        } catch (err) {
          console.error(err);
          setStatus("Something broke while reading the PDF. Try another file.", true);
          resetPreview();
        } finally {
          convertBtn.disabled = !selectedFile;
          convertBtn.textContent = "Convert to images";
        }
      };

      reader.onerror = () => {
        setStatus("Could not read that file. Please try again.", true);
        convertBtn.disabled = !selectedFile;
        convertBtn.textContent = "Convert to images";
      };

      reader.readAsArrayBuffer(selectedFile);
    });

    // Download all as ZIP
    downloadAllBtn.addEventListener("click", async () => {
      if (!imagesData.length) return;

      setStatus("Packing all pages into a ZIPâ€¦", true);

      const zip = new JSZip();
      imagesData.forEach((img) => {
        const base64Data = img.dataUrl.split(",")[1];
        zip.file("page-" + img.page + ".png", base64Data, { base64: true });
      });

      const blob = await zip.generateAsync({ type: "blob" });

      const link = document.createElement("a");
      const baseName = selectedFile
        ? selectedFile.name.replace(/\.pdf$/i, "")
        : "pdf-pages";

      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = baseName + "-images.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus("ZIP downloaded. Enjoy âœ¨", true);
    });
