const diffSpaceNodes = (oldNodes, newNodes) => {
    let AddSpaceNodeList = []
    let DeleteSpaceNodeList = []
    let UpdateSpaceNodeList = []

    newNodes.forEach((item) => {
        const index = oldNodes.findIndex((localItem) => localItem.obj_token === item.obj_token)
        if (index === -1) {
            AddSpaceNodeList.push(item)
        } else {
            if (Number(item.obj_edit_time) > Number(oldNodes[index].obj_edit_time)) {
                UpdateSpaceNodeList.push(item)
            }
        }
    })

    oldNodes.forEach((item) => {
        const index = newNodes.findIndex((localItem) => localItem.obj_token === item.obj_token)
        if (index === -1) {
            DeleteSpaceNodeList.push(item)
        }
    })

    return {
        AddSpaceNodeList,
        DeleteSpaceNodeList,
        UpdateSpaceNodeList
    }
}

export default diffSpaceNodes