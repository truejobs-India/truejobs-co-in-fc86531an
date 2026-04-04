

# Add Stop Extraction Button to Classic Employment News Pipeline

## Problem
When extracting jobs from a .docx file using AI in the classic Employment News pipeline, there is no way to stop the extraction mid-process. The loop iterates through all chunks sequentially with no abort mechanism.

## Solution
Add an `AbortController`-style stop mechanism using a `useRef` flag. When the user clicks "Stop", the flag is set and the chunk loop breaks after the current chunk finishes, marking the batch as `partial`.

## Files Changed: 1

### `src/components/admin/EmploymentNewsManager.tsx`

1. **Add a `useRef` abort flag** (~line 133):
   - `const stopExtractionRef = useRef(false);`

2. **Check the flag inside the chunk loop** (~line 370, inside `for` loop):
   - At the top of each iteration, check `if (stopExtractionRef.current)` → set `stoppedEarly = true` and `break`

3. **Reset the flag** at the start of `handleExtract` (~line 344):
   - `stopExtractionRef.current = false;`

4. **Add a stop handler**:
   - `const handleStopExtraction = () => { stopExtractionRef.current = true; }`

5. **Pass `onStopExtraction` to `UploadView`** (~line 825)

6. **Add Stop button in `UploadView`** (~line 1654–1661):
   - Show a red "Stop Extraction" button next to the progress bar when `isExtracting` is true
   - Uses `Square` icon from lucide-react for visual clarity

7. **Update the `UploadView` props interface** to accept `onStopExtraction?: () => void`

The stop is cooperative — it finishes the current chunk, saves progress as `partial`, and shows the existing partial-extraction toast. No data is lost.

