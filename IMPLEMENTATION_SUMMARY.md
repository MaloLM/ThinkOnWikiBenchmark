# Run Completion Notification & Error Handling Implementation

## Overview
This implementation adds automatic redirect functionality when a benchmark run completes, and robust error handling for corrupted archives.

## Changes Made

### 1. Backend: Run Completion Event (`src/backend/app/services/orchestrator.py`)

**Added `run_completed` event emission:**
- After all models complete their benchmarks, the orchestrator now emits a `run_completed` event
- This event includes:
  - `run_id`: The unique identifier for the run
  - `summary`: Statistics about the run (total models, completed, failed)
  - `message`: A human-readable completion message

**Location:** Lines 119-127 in `run_benchmark()` method

```python
# Notify run completion
if self.event_callback:
    await self.event_callback({
        "type": "run_completed",
        "run_id": run_id,
        "summary": summary,
        "message": f"Benchmark completed: {summary['completed']} succeeded, {summary['failed']} failed"
    })
```

**Enhanced `model_complete` event:**
- Added `model_index` and `total_models` to track progress
- This helps the frontend understand when all models are done

### 2. Frontend: Event Listener & Redirect (`src/frontend/src/hooks/useLiveMonitoring.ts`)

**Added `RunCompletedEvent` interface:**
- Defines the structure of the completion event
- Includes summary statistics

**Modified `useLiveMonitoring` hook:**
- Added optional `onRunCompleted` callback parameter
- When `run_completed` event is received:
  1. Logs a success message
  2. Clears the current model indicator
  3. Waits 2 seconds (to allow user to see completion message)
  4. Triggers the redirect callback

**Location:** Lines 124-145 and 619-634

```typescript
export function useLiveMonitoring(
  runId: string | undefined, 
  onRunCompleted?: (runId: string) => void
)
```

### 3. Frontend: Redirect Implementation (`src/frontend/src/pages/LiveMonitoring.tsx`)

**Added redirect handler:**
- Uses React Router's `useNavigate` hook
- Implements `handleRunCompleted` callback
- Navigates to `/archives/{run_id}` when run completes

**Location:** Lines 1-2, 14-18

```typescript
const navigate = useNavigate();

const handleRunCompleted = useCallback((completedRunId: string) => {
  console.log('Run completed, redirecting to archive:', completedRunId);
  navigate(`/archives/${completedRunId}`);
}, [navigate]);

const monitoringState = useLiveMonitoring(run_id, handleRunCompleted);
```

### 4. Frontend: Archive Error Handling (`src/frontend/src/pages/RunAnalysis.tsx`)

**Enhanced error display:**
- Shows a user-friendly error page when archive loading fails
- Displays:
  - Large warning icon
  - Clear error title
  - Specific error message
  - Explanation about potential corruption
  - Two action buttons:
    - **Retry**: Attempts to reload the archive
    - **Back to Archives**: Redirects to the archives list

**Location:** Lines 1-2, 437-465

```typescript
if (error) {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-16 h-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Archive Error
        </h2>
        <p className="text-red-600 dark:text-red-400 mb-6">
          {error}
        </p>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          This archive may be corrupted or unreadable...
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={loadArchiveData}>Retry</button>
          <button onClick={() => window.location.href = '/archives'}>
            Back to Archives
          </button>
        </div>
      </div>
    </div>
  );
}
```

## User Experience Flow

### Normal Completion Flow:
1. User starts a benchmark run
2. Frontend connects to WebSocket and displays live monitoring
3. Models run sequentially, updating the UI in real-time
4. When all models complete:
   - Backend emits `run_completed` event
   - Frontend displays "✅ Benchmark completed" message in logs
   - After 2 seconds, automatically redirects to `/archives/{run_id}`
5. User sees the completed run analysis page

### Error Handling Flow:
1. User navigates to an archive (either manually or via redirect)
2. If archive is corrupted/unreadable:
   - Error is caught during API call
   - User-friendly error page is displayed
   - User can choose to:
     - Retry loading (in case of temporary network issue)
     - Return to archives list to select another run

## Robustness Features

### Race Condition Prevention:
- 2-second delay before redirect ensures all UI updates complete
- WebSocket events are processed sequentially
- State updates are atomic using React's setState

### Network Issue Handling:
- WebSocket has automatic reconnection (10 attempts, 3s interval)
- Archive loading has retry functionality
- Clear error messages guide user actions

### Edge Cases Covered:
- Run stopped by user (no redirect, shows stopped status)
- Partial run completion (only completed models counted)
- Missing or corrupted archive data (graceful error display)
- Network disconnection during run (reconnection attempts)

## Testing Recommendations

1. **Normal Flow Test:**
   - Start a benchmark with 2-3 models
   - Verify automatic redirect after completion
   - Check that archive page loads correctly

2. **Error Handling Test:**
   - Manually navigate to a non-existent run ID
   - Verify error page displays correctly
   - Test both "Retry" and "Back to Archives" buttons

3. **Network Issues Test:**
   - Disconnect network during a run
   - Verify reconnection behavior
   - Check that state is preserved after reconnection

4. **Stop Functionality Test:**
   - Start a run and stop it mid-execution
   - Verify no automatic redirect occurs
   - Check that stopped status is displayed correctly

## Configuration

No configuration changes required. The implementation uses existing:
- WebSocket connection settings
- API endpoints
- React Router configuration

## Performance Impact

- Minimal: Single additional WebSocket event per run
- 2-second delay is user-imperceptible
- No additional API calls required
- Error handling adds negligible overhead

## Future Enhancements

Potential improvements:
1. Configurable redirect delay (user preference)
2. Toast notification before redirect
3. Option to disable auto-redirect
4. Archive integrity check before redirect
5. Retry with exponential backoff for corrupted archives
