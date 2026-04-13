export function buildSmartCheckoutCommand(branchName: string, baseBranch: string) {
  return `git fetch origin && (git checkout ${branchName} 2>/dev/null || (git show-ref --verify --quiet refs/remotes/origin/${branchName} && git checkout -b ${branchName} origin/${branchName} || (git checkout -b ${branchName} origin/${baseBranch} && git push -u origin ${branchName})))`
}
