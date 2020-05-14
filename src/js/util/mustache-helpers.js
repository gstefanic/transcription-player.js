function enumerate(array) {
    if (array.constructor === Array) {
        for(var i = 0; i < array.length; i++) {
            if (array[i] && !array[i]['@index']) {
                array[i]['@index'] = i;
            }
        }
    }
    return array;
}

export default {
    enumerate
}