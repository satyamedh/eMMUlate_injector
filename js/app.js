document.addEventListener('DOMContentLoaded', () => {
  const appMode = document.getElementById('appMode');
  const tutorialMode = document.getElementById('tutorialMode');
  const tutorialContent = document.getElementById('tutorialContent');

  // --- Tutorial Logic (Always Visible) ---
  tutorialMode.classList.remove('hidden');
  
  // Default Tutorial Markdown
  const tutorialMarkdown = `
# Welcome to eMMUlator injector!
This tool allows you to inject 3DES decryption keys into .tns files for use with firebird.

## CX II firebird emulation:
1. After getting your injected_btrom.tns, create a new CX II kit in firebird.
2. Set boot1 to your injected_btrom.tns file, and create a new flash with the other files you got from polydumper.
3. Finally, start that kit. It will ask you to install the OS, and you should be able to drop the OS installation file used by your specific calculator model(.tcc2, .tco2, .tct2, etc).
4. The installation will proceed and there will be a blank screen at times. After waiting for a while, click the reset button on the top left in case of a blank screen. After a couple resets, the installation should complete and you will have a working emulated CX II calculator with the OS installed!

## Instructions on how to use eMMUlator can be found on the Github page [here](https://github.com/satyamedh/eMMUlate)



  `;

  // Render Markdown
  if (typeof marked !== 'undefined') {
    tutorialContent.innerHTML = marked.parse(tutorialMarkdown);
  } else {
    tutorialContent.innerHTML = '<p class="text-red-500">Error: Marked library not loaded.</p>';
  }

  // --- URL Parameters Logic ---
  const urlParamsContainer = document.getElementById('urlParamsContainer');
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  // Check if we have any URL parameters
  if (Array.from(urlParams).length > 0) {
    // --- APP MODE ---
    appMode.classList.remove('hidden');
    // tutorialMode.classList.add('hidden'); // Tutorial is now always visible

    urlParamsContainer.innerHTML = ''; // Clear default message
    const list = document.createElement('ul');
    list.classList.add('list-disc', 'list-inside');

    // --- 3DES Key Parsing Logic ---
    const keys = {};
    console.log("--- Decryption Keys ---");

    for (let set = 1; set <= 4; set++) {
      keys[`set${set}`] = [];
      for (let keyIndex = 1; keyIndex <= 3; keyIndex++) {
        const leftPart = urlParams.get(`l${set}${keyIndex}`);
        const rightPart = urlParams.get(`r${set}${keyIndex}`);

        if (leftPart && rightPart) {
          const fullKey = leftPart + rightPart;
          keys[`set${set}`].push(fullKey);
          console.log(`Set ${set}, Key ${keyIndex}: ${fullKey}`);
          
          // Display in UI
          const listItem = document.createElement('li');
          const boldKey = document.createElement('span');
          boldKey.className = 'font-semibold text-blue-400';
          boldKey.textContent = `Set ${set} Key ${keyIndex}`;
          
          listItem.appendChild(boldKey);
          listItem.appendChild(document.createTextNode(`: ${fullKey}`));
          list.appendChild(listItem);
        }
      }
    }
    console.log("All Keys:", keys);

    urlParamsContainer.appendChild(list);

    // --- File Selector Logic (Only needed in App Mode) ---
    const fileInput = document.getElementById('fileInput');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const injectBtn = document.getElementById('injectBtn');
    let selectedFile = null;

    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();

        if (fileExtension === 'bin' || fileExtension === 'tns') {
          selectedFile = file;
          fileNameDisplay.textContent = `Selected file: ${fileName}`;
          fileNameDisplay.classList.remove('hidden');
          fileNameDisplay.classList.remove('text-red-500');
          fileNameDisplay.classList.add('text-green-400');
          injectBtn.classList.remove('hidden'); // Show inject button
          console.log('File selected:', file);
        } else {
          selectedFile = null;
          fileNameDisplay.textContent = 'Invalid file type. Please select a .bin or .tns file.';
          fileNameDisplay.classList.remove('hidden');
          fileNameDisplay.classList.remove('text-green-400');
          fileNameDisplay.classList.add('text-red-500');
          fileInput.value = '';
          injectBtn.classList.add('hidden');
        }
      } else {
        selectedFile = null;
        fileNameDisplay.classList.add('hidden');
        injectBtn.classList.add('hidden');
      }
    });

    // --- Injection Logic ---
    injectBtn.addEventListener('click', () => {
      if (!selectedFile) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        const dataView = new DataView(arrayBuffer);
        
        // Set Indices: 0x27, 0x3d, 0x25, 0x2d
        const setIndices = {
          1: 0x27,
          2: 0x3d,
          3: 0x25,
          4: 0x2d
        };

        try {
          for (let set = 1; set <= 4; set++) {
            const index = setIndices[set];
            let baseAddress;
            let adjustedIndex = index;

            // Calculate Offset based on C logic
            if (index < 0x75) {
              if (index < 0x20) {
                baseAddress = 0x00026000;
              } else {
                baseAddress = 0x00027800;
                adjustedIndex = index - 0x20;
              }
              
              const offset = baseAddress + (adjustedIndex * 24);
              console.log(`Injecting Set ${set} (Index 0x${index.toString(16)}) at Offset 0x${offset.toString(16)}`);

              // Inject 3 Keys (Left and Right parts)
              for (let keyIndex = 1; keyIndex <= 3; keyIndex++) {
                const lKey = urlParams.get(`l${set}${keyIndex}`);
                const rKey = urlParams.get(`r${set}${keyIndex}`);

                if (lKey && rKey) {
                  // Parse hex strings to integers
                  const lValue = parseInt(lKey, 16);
                  const rValue = parseInt(rKey, 16);

                  // Calculate position for this specific key part
                  // Each key has 2 parts (L, R), 4 bytes each.
                  // Key 1 starts at offset + 0
                  // Key 2 starts at offset + 8
                  // Key 3 starts at offset + 16
                  const keyOffset = offset + ((keyIndex - 1) * 8);

                  // Write Right Part (Little Endian)
                  dataView.setUint32(keyOffset, rValue, true);

                  // Write Left Part (Little Endian)
                  dataView.setUint32(keyOffset + 4, lValue, true);                  

                  console.log(`  Key ${keyIndex}: L=0x${lValue.toString(16)} R=0x${rValue.toString(16)}`);
                } else {
                  console.warn(`  Missing key parts for Set ${set} Key ${keyIndex}`);
                }
              }
            }
          }

          // Trigger Download
          const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `injected_${selectedFile.name}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          alert('Injection successful! File downloaded.');

        } catch (error) {
          console.error("Injection failed:", error);
          alert('Injection failed. See console for details.');
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    });

  } else {
    // --- NO PARAMS ---
    appMode.classList.add('hidden');
    // Tutorial is already visible
  }
});
