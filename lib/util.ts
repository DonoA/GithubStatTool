export async function asyncMap(arr: Array<any>, func: Function): Promise<Array<any>> {
    const rtn = [];
    for (let i = 0; i < arr.length; i++) {
        const res = await func(arr[i], i, arr);
        rtn.push(res);
    }
    return rtn;
}

export async function asyncForEach(arr: Array<any>, func: Function) {
    await asyncMap(arr, func);
}