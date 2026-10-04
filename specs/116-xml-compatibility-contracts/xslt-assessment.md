# XSLT assessment

**Date**: 2026-10-02  
**Decision**: Use the existing TypeScript XML migrations and class loaders for this feature.
XSLT is a viable way to express XML transformations, but adding an XSLT runtime is not justified
by these migrations. This is a design choice, not a claim that XSLT cannot validate this format.

## Where XSLT fits

Template matching is well suited to root relocation, renamed containers, and selective subtree
rewrites. The 2.3.0 Score relocation could be expressed cleanly in a stylesheet. Separate modes
could distinguish a project migration from a standalone resource normalization; using XSLT would
not remove the need for that ownership distinction.

XSLT can also express validation. XSLT 3.0's failing unmatched-node mode requires an explicit
template for each processed item. Rules must deliberately traverse attributes as well as children
and check cardinality, values, and references; selecting only recognized nodes still misses
unexpected input. [W3C XSLT 3.0, section 6.7.6](https://www.w3.org/TR/xslt-30/)

Assertions are not a sufficient acceptance mechanism when they can be disabled. An implementation
using XSLT must make rejection unconditional or enforce assertion configuration; Saxon's documented
options distinguish compile-time and runtime enablement.
[Saxon assertion options](https://www.saxonica.com/html/documentation10/using-xsl/commandline/index.html)

## Fit against Blue's constraints

| Option | Benefit | Cost or constraint | Decision |
| --- | --- | --- | --- |
| Existing TypeScript Element transforms + owner-local checks | Shares parsed data, model rules, exact-decimal helpers, object-reference maps, and diagnostic context across projects/resources | Each owner must explicitly declare accepted members and checked values; current permissive loaders need repair | Selected. No new dependency, stylesheet compiler, or second canonical model. |
| Native browser XSLTProcessor | Built-in tree transformation | Requires DOM, unavailable in Node, violates the data-core boundary; Chromium has deprecated it and plans removal | Excluded for the portable data core. |
| Java/native XSLT engine | Established XML tooling | Host/process dependency for project and standalone loading, including hosts without Java; adds packaging and invocation paths | Excluded from required runtime loading. |
| SaxonJS | XSLT 3.0 in browser and Node; reusable stylesheets | New runtime/compiler integration, SEF artifacts, another tree/serialization boundary, and product-specific license review | Not introduced for this feature. |
| Other JavaScript XSLT engines | Can avoid native browser support and Java | Need demonstrated feature conformance, diagnostics/text fidelity, portable bundling, and distribution review | Not introduced; a smaller library is not automatically a smaller complete solution. |
| XSLT as an offline independent reference | Could compare structural outcomes in XML-heavy future work | Separate tooling/corpus maintenance, without solving runtime acceptance | No new offline tool now; existing historical evidence plus independently specified synthetic expectations suffice. |

Chromium's published plan removes XSLTProcessor in Chrome 158, scheduled for November 17, 2026;
the portable design must not depend on its presence in any particular Electron version.
[Chrome removal plan](https://developer.chrome.com/docs/web-platform/deprecating-xslt)

SaxonJS documents browser/Node execution and stylesheet compilation to SEF; its product page
describes the runtime as free of charge but not open source. This assessment does not approve
redistribution or infer license compatibility from price.
[SaxonJS product and licensing overview](https://www.saxonica.com/html/saxonjs/index.html)

There are JavaScript alternatives: DesignLiquido's processor advertises operation without native
libraries and its inspected package metadata declares LGPL-3.0. Adoption would require checking
the actual selected release, license text, feature subset, and packaging obligations. No such
dependency is incorporated or approved by this plan.
[Processor repository](https://github.com/DesignLiquido/xslt-processor),
[package metadata](https://github.com/DesignLiquido/xslt-processor/blob/main/package.json)

## Migration and validation remain separate responsibilities

An identity transform can preserve an unexpected member without accepting it; a selective
transform can accidentally erase it. Neither is sufficient validation. Any migration mechanism
must validate historical input before removing/rewriting its members, reject conflicts, then
validate canonical output. Exact archived source export must retain the original payload rather
than a transform's reserialization. Runtime availability, significant text, independent copies,
atomic activation, and history restoration still require model and host checks.

Blue's conversions also include exact-resolution rules, relative widget/line values, time-unit
domains, project instrument reference expansion, and contextual rates. They are expressible in
XSLT, but sharing existing TypeScript semantic helpers avoids duplicating these rules in a second
language. The current defects arise from missing rules and skipped work, not from lack of an XML
transformation language.

## Revisit criterion

Revisit XSLT if a concrete collection of complex structural migrations becomes substantially
clearer as stylesheets shared with another tool or implementation. A proposal must select and
license a portable processor, use fixed explicitly imported assets, preserve original diagnostic
locations/text, prohibit external document execution from input, and pass the same project and
standalone acceptance matrix. No processor abstraction or alternate backend is added in advance.
