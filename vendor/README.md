# Vendored BroMetal preview

`brometal-0.12.3-pr2-d519e15.tgz` is a reproducible package build from commit
`d519e15da69000fac934168bafc323c465dc785c` on
[ericdrowell/brometal#2](https://github.com/ericdrowell/brometal/pull/2).

The preview is pinned because Town Study uses the pull request's cut-out sprite support and
per-draw instance counts before those changes have a published release. The tarball was produced
with `npm ci`, `npm run build -w brometal`, and `npm pack` from that exact commit. It includes
BroMetal's MIT license and README.

Replace this file dependency with the first published BroMetal release that includes the pull
request, then remove the tarball.
