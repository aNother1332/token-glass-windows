# Local memory observations

Windows 11 x64, expanded widget, no open detail panel. Memory covers the host and all descendants, including transient Tokscale processes. This is an observational comparison across two runs, not a strictly identical-input benchmark or a guarantee for other machines.

| Metric | Previous Electron widget | Native widget |
|---|---:|---:|
| Average private working set | 124.4 MiB | 55.3 MiB |
| Private working-set range | 119.5–131.8 MiB | 47.2–61.4 MiB |
| Average sum of working sets | 407.7 MiB | 141.2 MiB |
| Average private committed bytes | 261.7 MiB | 119.5 MiB |

The previous run contained 12 samples over about one minute. The native run contained 60 valid samples over about 629 seconds. One additional attempted cold-start sample referenced an already exited host and contained no processes; it was excluded, not treated as zero memory consumption. Raw records remain local and are not published because they contain process identifiers and machine-specific timestamps.

The native average private working set was approximately 56% lower than the prior observed average. The native widget does not start Chromium renderer, GPU or network-helper processes. A standalone Node collector still runs during an active task, and transient reporting processes can produce peaks. Windows DWM remains responsible for the Acrylic effect and uses system graphics resources.

Private working set measures private resident RAM. Summing working sets can count shared pages multiple times; private committed bytes includes private virtual memory that is not necessarily resident. These values must not be substituted for one another.

Opening the full Electron panel increases memory use. Closing it releases its processes while the native widget can continue for active tasks. The lifecycle checks cover concurrent tasks, stale stop events, manual-panel retention, the delayed exit and owned-process cleanup.

Ten minutes of sampling does not prove the absence of a long-term leak. To repeat a longer local sample, start only the widget and run `app/scripts/widget-memory.ps1`; it records the mode of every sample so an accidentally opened panel can be identified.

A subsequent 12-sample check of the final delivery build observed an average private working set of 48.0 MiB (47.3–48.2 MiB), average sum of working sets of 130.3 MiB, and average private committed bytes of 104.4 MiB. Cache state and sampling phase affect these values; the longer 55.3 MiB observation is the more conservative headline comparison.
