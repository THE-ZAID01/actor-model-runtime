# College project report guide

This guide maps the implementation documentation to a formal engineering
project report. It deliberately does not invent student details, references,
test outcomes, screenshots, or claims of novelty. Fill all institution-specific
and evidence-based sections with information you can verify.

## Chapters and source material

| Chapter                        | What to include                                                                                   | Existing documentation                                                                                                                                                                            | Useful diagrams                                         | Useful implementation screenshots                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Introduction                | Actor model context, project motivation, intended audience and high-level summary                 | [Project overview](PROJECT_OVERVIEW.md), [problem statement](PROBLEM_STATEMENT.md)                                                                                                                | System architecture                                     | Home dashboard and project page                             |
| 2. Problem Statement           | Concrete problem, current-process limitations, project boundary                                   | [Problem statement](PROBLEM_STATEMENT.md)                                                                                                                                                         | System architecture                                     | Avoid screenshots as a substitute for the problem analysis  |
| 3. Objectives                  | Measurable project objectives and scope                                                           | [Objectives and scope](OBJECTIVES_AND_SCOPE.md)                                                                                                                                                   | Lifecycle and deployment                                | Actors page, worker page                                    |
| 4. Existing System             | Describe the specific baseline actually studied; cite sources and do not invent a surveyed system | [Problem statement](PROBLEM_STATEMENT.md), [architecture decisions](ARCHITECTURE_DECISIONS.md)                                                                                                    | Optional comparison diagram made by the student         | Screenshots only if a real baseline exists and may be shown |
| 5. Proposed System             | Proposed design, boundaries, and differences from the verified baseline                           | [System architecture](SYSTEM_ARCHITECTURE.md), [limitations](LIMITATIONS_AND_FUTURE_SCOPE.md)                                                                                                     | System architecture and component interaction           | Dashboard and actor details                                 |
| 6. Literature/Technology Study | Properly cited actor-model, database, framework, and orchestration sources                        | [Architecture decisions](ARCHITECTURE_DECISIONS.md), [configuration](CONFIGURATION.md)                                                                                                            | Usually none; architecture context may help             | None required                                               |
| 7. Requirement Analysis        | Functional/non-functional requirements, assumptions, dependencies, and constraints                | [Objectives and scope](OBJECTIVES_AND_SCOPE.md), [configuration](CONFIGURATION.md), [security](SECURITY_CONSIDERATIONS.md)                                                                        | Deployment architecture                                 | Setup/configuration screenshots, with secrets removed       |
| 8. System Architecture         | Component boundaries, call paths, data stores, Kubernetes relationship                            | [System architecture](SYSTEM_ARCHITECTURE.md), [component design](COMPONENT_DESIGN.md)                                                                                                            | System architecture, component interaction, deployment  | Dashboard, cluster page                                     |
| 9. System Design               | Actor schema, message flow, ownership, state updates, migration, singleton protocol               | [Actor model](ACTOR_MODEL.md), [database design](DATABASE_DESIGN.md), [message processing](MESSAGE_PROCESSING.md), [rebalancing](DYNAMIC_REBALANCING.md), [singleton actors](SINGLETON_ACTORS.md) | Lifecycle, message flow, rebalance, singleton           | Actor detail/message history, rebalancing, singleton page   |
| 10. Implementation             | Source modules, implementation choices, API/UI, infrastructure manifests                          | [Component design](COMPONENT_DESIGN.md), [API reference](API_REFERENCE.md), [Kubernetes](KUBERNETES_INTEGRATION.md)                                                                               | Component interaction and deployment                    | Actor creation, message result, workers, cluster page       |
| 11. Testing and Results        | Test plan, environment, commands, actual pass/fail results, evidence and limitations              | [Testing and validation](TESTING_AND_VALIDATION.md)                                                                                                                                               | Message flow or lifecycle                               | Genuine terminal/API/browser captures and test logs         |
| 12. Advantages                 | Advantages supported by implementation and observed evidence; qualify them                        | [Project overview](PROJECT_OVERVIEW.md), [architecture decisions](ARCHITECTURE_DECISIONS.md)                                                                                                      | System architecture                                     | Only real running pages                                     |
| 13. Limitations                | Known technical and validation limitations                                                        | [Limitations](LIMITATIONS_AND_FUTURE_SCOPE.md), [security](SECURITY_CONSIDERATIONS.md)                                                                                                            | Optional failure-flow diagram                           | None required                                               |
| 14. Future Scope               | Prioritized improvements, rationale, and feasibility                                              | [Limitations](LIMITATIONS_AND_FUTURE_SCOPE.md)                                                                                                                                                    | Optional proposed diagrams, clearly labeled future work | None required                                               |
| 15. Conclusion                 | Summarize objectives actually completed and evidence collected                                    | [Objectives](OBJECTIVES_AND_SCOPE.md), [testing](TESTING_AND_VALIDATION.md)                                                                                                                       | System architecture                                     | Optionally final verified dashboard                         |
| 16. References                 | Sources you actually consulted, using the college-required citation style                         | Official source documentation you personally consult                                                                                                                                              | None                                                    | None                                                        |

## Information you must supply personally

- Student name(s), roll/registration number(s), class, department, and academic
  year.
- College/university name, logo/format requirements, and submission rules.
- Project guide/supervisor name, designation, and approval details.
- Project duration, milestones, team responsibilities, and actual contribution.
- Any statement of originality, acknowledgements, declaration, or certificate
  required by your institution.
- Actual deployment environment and versions (OS, Node.js, npm, Docker,
  Kubernetes/Minikube, MongoDB, Redis).
- Actual test commands, date, outputs, pass/fail results, bugs, and evidence.
- Genuine screenshots from your own running application; remove credentials,
  personal data, and sensitive network details.
- References you actually read and cite, formatted in the required academic
  style.

## Suggested evidence collection

For each test, record the setup, exact action, expected result, observed result,
and evidence filename. Keep raw logs and sanitized screenshots. Do not copy
expected results from the test plan into the report's results column without
running the test.

## Diagram use

The repository diagrams describe the inspected implementation. If you modify
them for a report, distinguish current implementation from proposed future
design, retain a legend for flow/ownership, and verify Mermaid renders
correctly. Do not represent a future queue, autoscaler, or security mechanism
as an existing component.

## References

Do not cite sources that were not consulted. Suitable primary sources to
consider consulting include official Node.js, Express, MongoDB/Mongoose, Redis,
Kubernetes, Docker, and actor-model documentation, plus peer-reviewed papers
that your institution approves. Record exact title, author/organization,
version/date, URL or publication details, access date if required, and citation
style. This guide does not provide fabricated academic references.
