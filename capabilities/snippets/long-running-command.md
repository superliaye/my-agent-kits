## Long-running commands

When a command yields a process handle, preserve the complete result and continue through that
handle using the longest supported wait interval. Empty output means the same command is still in
flight; remain in this step until it completes or produces actionable output.
