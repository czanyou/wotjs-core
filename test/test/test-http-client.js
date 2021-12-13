async function request(url) {
    console.log(url);
    const response = await window.fetch(url);
    const body = await response.text();
    const headers = response.headers;
    console.log('response', response.url, response.status, response.statusText, headers.get('Content-Length'), body.length);
}

(async () => {
    const url = 'http://localhost:8080/test';

    request(url);
    request(url);

})();
